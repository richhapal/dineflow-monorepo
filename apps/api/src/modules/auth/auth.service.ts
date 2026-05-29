import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { SubscriptionPlan, SubscriptionStatus, StaffRole } from '@dineflow/types';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerRestaurant(dto: RegisterDto) {
    // 1. Check slug uniqueness
    const existing = await this.prisma.restaurant.findUnique({
      where: { slug: dto.restaurant_slug },
    });
    if (existing) throw new ConflictException('Restaurant slug is already taken');

    // 2. Hash password
    const password_hash = await bcrypt.hash(dto.password, 12);

    // 3. Create Restaurant + Owner Staff in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          slug: dto.restaurant_slug,
          name: dto.restaurant_name,
          city: dto.city,
          timezone: dto.timezone || 'Asia/Kolkata',
          plan: SubscriptionPlan.GROWTH,
          subscription_status: SubscriptionStatus.TRIAL,
          trial_ends_at: dayjs().add(30, 'day').toDate(),
          invoice_seq_counter: 0,
        },
      });

      const staff = await tx.staff.create({
        data: {
          restaurant_id: restaurant.id,
          name: dto.owner_name,
          email: dto.email,
          phone: dto.phone,
          role: StaffRole.OWNER,
          password_hash,
          salary_amount: 0,
          is_active: true,
        },
      });

      return { restaurant, staff };
    });

    const { password_hash: _ph, pin, ...safeStaff } = result.staff as any;

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: result.staff.id,
      restaurant_id: result.restaurant.id,
      role: StaffRole.OWNER,
      email: dto.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      restaurant: result.restaurant,
      staff: safeStaff,
    };
  }

  async loginOwner(dto: LoginDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { email: dto.email, deleted_at: null },
      include: { restaurant: true },
    });

    if (!staff || !staff.password_hash) throw new UnauthorizedException('Invalid credentials');
    if (!staff.is_active) throw new ForbiddenException('Account is deactivated');

    const valid = await bcrypt.compare(dto.password, staff.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { password_hash, pin, ...safeStaff } = staff as any;

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: staff.id,
      restaurant_id: staff.restaurant_id,
      role: staff.role,
      email: staff.email ?? undefined,
    };

    return {
      access_token: this.jwtService.sign(payload),
      restaurant: staff.restaurant,
      staff: safeStaff,
    };
  }

  async loginStaff(dto: PinLoginDto) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        restaurant_id: dto.restaurant_id,
        pin: dto.pin,
        deleted_at: null,
      },
    });

    if (!staff) throw new UnauthorizedException('Invalid PIN');
    if (!staff.is_active) throw new ForbiddenException('Account is deactivated');

    const allowedRoles = [StaffRole.WAITER, StaffRole.KITCHEN, StaffRole.CASHIER, StaffRole.MANAGER];
    if (!allowedRoles.includes(staff.role as any)) {
      throw new ForbiddenException('PIN login not allowed for this role');
    }

    const { password_hash, pin, ...safeStaff } = staff as any;

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: staff.id,
      restaurant_id: staff.restaurant_id,
      role: staff.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      staff: safeStaff,
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: payload.sub,
        restaurant_id: payload.restaurant_id,
        role: payload.role,
        email: payload.email,
      };
      return { access_token: this.jwtService.sign(newPayload) };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async validateJwt(payload: JwtPayload) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: payload.sub, restaurant_id: payload.restaurant_id, deleted_at: null },
    });
    if (!staff || !staff.is_active) throw new UnauthorizedException('User not found or deactivated');
    return { ...staff, restaurant_id: payload.restaurant_id, role: payload.role };
  }

  async getMe(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { restaurant: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    const { password_hash, pin, ...safe } = staff as any;
    return safe;
  }
}
