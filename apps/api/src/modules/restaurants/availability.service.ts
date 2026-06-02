import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityResult } from '@dineflow/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private isWithinHours(current: string, open: string, close: string): boolean {
    if (close < open) {
      // crosses midnight e.g. 20:00 - 02:00
      return current >= open || current < close;
    }
    return current >= open && current < close;
  }

  /** Check by restaurant ID — used by authenticated dashboard endpoints */
  async checkAvailabilityById(id: string): Promise<AvailabilityResult> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) return { state: 'CLOSED', message: 'Restaurant not found' };
    return this.computeAvailability(restaurant);
  }

  async checkAvailability(slug: string): Promise<AvailabilityResult> {
    const restaurant = await this.prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant) return { state: 'CLOSED', message: 'Restaurant not found' };
    return this.computeAvailability(restaurant);
  }

  /** Core availability logic — works with any restaurant object */
  private async computeAvailability(restaurant: any): Promise<AvailabilityResult> {
    // 1. Subscription check
    if (
      restaurant.subscription_status === 'CANCELLED' ||
      restaurant.subscription_status === 'PAUSED'
    ) {
      return { state: 'SUBSCRIPTION_LAPSED', message: 'Restaurant subscription is inactive' };
    }

    if (
      restaurant.subscription_status === 'TRIAL' &&
      restaurant.trial_ends_at &&
      dayjs().isAfter(dayjs(restaurant.trial_ends_at))
    ) {
      return { state: 'SUBSCRIPTION_LAPSED', message: 'Trial has expired' };
    }

    // 2. Ordering enabled check
    if (!restaurant.is_ordering_enabled) {
      return { state: 'DISABLED', message: 'Online ordering is disabled' };
    }

    // 3. Manual override — owner explicitly forced closed
    if (!restaurant.is_open) {
      return { state: 'CLOSED', message: 'Manually closed by owner', manual_override: true } as any;
    }

    // 4. Ordering paused
    if (restaurant.is_ordering_paused) {
      return { state: 'ORDERING_PAUSED', message: 'Ordering is temporarily paused' };
    }

    // ── Use restaurant's own timezone (server-side, never client time) ──────
    const tz = restaurant.timezone || 'Asia/Kolkata';
    const now = dayjs().tz(tz);
    const todayDate = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm');
    const dayOfWeek = now.day(); // 0 = Sunday

    // 5. Holiday check
    const holiday = await this.prisma.holiday.findFirst({
      where: { restaurant_id: restaurant.id, date: new Date(todayDate) },
    });
    if (holiday) {
      return {
        state: 'HOLIDAY',
        message: `Closed: ${holiday.reason}`,
        reason: holiday.reason,
        reopen: 'tomorrow',
      };
    }

    // 6. Business hours check
    const hours = await this.prisma.businessHours.findFirst({
      where: { restaurant_id: restaurant.id, day_of_week: dayOfWeek },
    });

    if (!hours || !hours.is_open) {
      return { state: 'WEEKLY_OFF', message: 'Closed today' };
    }

    if (!this.isWithinHours(currentTime, hours.open_time, hours.close_time)) {
      return {
        state: 'CLOSED',
        opens_at: hours.open_time,
        closes_at: hours.close_time,
        message: currentTime < hours.open_time
          ? `Opens at ${hours.open_time}`
          : `Closed — reopens tomorrow at ${hours.open_time}`,
      };
    }

    // 7. Break time check
    if (
      hours.has_break &&
      hours.break_start &&
      hours.break_end &&
      this.isWithinHours(currentTime, hours.break_start, hours.break_end)
    ) {
      return {
        state: 'BREAK',
        message: `On break until ${hours.break_end}`,
        resumes_at: hours.break_end,
      };
    }

    // 8. Open
    return {
      state: 'OPEN',
      opens_at: hours.open_time,
      closes_at: hours.close_time,
      server_time: now.format('HH:mm'),
      timezone: tz,
    };
  }
}
