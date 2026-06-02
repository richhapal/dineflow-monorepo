import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpsertBusinessHoursDto } from './dto/business-hours.dto';
import { AddHolidayDto } from './dto/add-holiday.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { PauseOrderingDto } from './dto/pause-ordering.dto';
import { AvailabilityService } from './availability.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly gateway: WebsocketGateway,
  ) {}

  private async assertOwnership(id: string, restaurantId: string) {
    if (id !== restaurantId) throw new ForbiddenException('Access denied');
  }

  async findById(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        businessHours: { orderBy: { day_of_week: 'asc' } },
        holidays: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async update(id: string, dto: UpdateRestaurantDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    return this.prisma.restaurant.update({ where: { id }, data: dto as any });
  }

  async checkAvailability(slug: string) {
    return this.availability.checkAvailability(slug);
  }

  async getPublicConfig(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo_public_id: true,
        theme_config: true,
        enabled_languages: true,
        default_language: true,
        is_ordering_enabled: true,
        ordering_mode: true,
        city: true,
        timezone: true,
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async updateTheme(id: string, dto: UpdateThemeDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    return this.prisma.restaurant.update({
      where: { id },
      data: {
        active_theme_id: dto.active_theme_id,
        theme_config: dto.theme_config as any,
      },
    });
  }

  async upsertBusinessHours(id: string, dto: UpsertBusinessHoursDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    await this.prisma.$transaction(
      dto.hours.map((h) =>
        this.prisma.businessHours.upsert({
          where: { restaurant_id_day_of_week: { restaurant_id: id, day_of_week: h.day_of_week } },
          create: { restaurant_id: id, ...h },
          update: h,
        }),
      ),
    );
    return this.prisma.businessHours.findMany({
      where: { restaurant_id: id },
      orderBy: { day_of_week: 'asc' },
    });
  }

  async addHoliday(id: string, dto: AddHolidayDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    return this.prisma.holiday.create({
      data: { restaurant_id: id, date: new Date(dto.date), reason: dto.reason, note: dto.note },
    });
  }

  async removeHoliday(id: string, holidayId: string, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    return this.prisma.holiday.delete({ where: { id: holidayId } });
  }

  async toggleOpen(id: string, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return this.prisma.restaurant.update({
      where: { id },
      data: { is_open: !restaurant.is_open },
    });
  }

  async toggleOrderingPaused(id: string, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    const restaurant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return this.prisma.restaurant.update({
      where: { id },
      data: { is_ordering_paused: !restaurant.is_ordering_paused },
    });
  }

  async setOrderingPause(id: string, dto: PauseOrderingDto, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    const updated = await this.prisma.restaurant.update({
      where: { id },
      data: {
        is_ordering_paused: dto.paused,
        ordering_pause_reason: dto.paused ? (dto.reason || null) : null,
        ordering_pause_until: dto.paused && dto.pause_until ? new Date(dto.pause_until) : null,
      },
      select: {
        id: true,
        is_ordering_paused: true,
        ordering_pause_reason: true,
        ordering_pause_until: true,
      },
    });
    // Broadcast to dashboard + customers in real-time
    this.gateway.emitRestaurantStatus(id, dto.paused, dto.reason);
    return updated;
  }

  async getOrderingStatus(id: string, restaurantId: string) {
    await this.assertOwnership(id, restaurantId);
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      select: {
        id: true,
        is_ordering_paused: true,
        ordering_pause_reason: true,
        ordering_pause_until: true,
        single_qr_slug: true,
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async getPublicOrderingStatus(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        is_ordering_paused: true,
        ordering_pause_reason: true,
        ordering_pause_until: true,
      },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return {
      paused: restaurant.is_ordering_paused,
      reason: restaurant.ordering_pause_reason,
      pause_until: restaurant.ordering_pause_until,
    };
  }
}
