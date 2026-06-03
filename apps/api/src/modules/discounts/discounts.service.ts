import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiscountDto, UpdateDiscountDto, ValidateCouponDto } from './dto/create-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async getDiscounts(restaurantId: string, filters: {
    scope?: string; applied_by?: string; active_only?: boolean;
  } = {}) {
    const where: any = {
      restaurant_id: restaurantId,
      deleted_at: null,
    };
    if (filters.scope)      where.scope      = filters.scope;
    if (filters.applied_by) where.applied_by = filters.applied_by;
    if (filters.active_only === true) where.is_active = true;

    return this.prisma.discount.findMany({
      where,
      include: {
        menuItem:  { select: { id: true, name: true } },
        category:  { select: { id: true, name: true } },
      },
      orderBy: [{ is_active: 'desc' }, { created_at: 'desc' }],
    });
  }

  /** Quick-access presets for billing — WAITER_MANUAL, ENTIRE_ORDER, active */
  async getPresets(restaurantId: string) {
    return this.prisma.discount.findMany({
      where: {
        restaurant_id: restaurantId,
        applied_by: 'WAITER_MANUAL',
        scope: 'ENTIRE_ORDER',
        is_active: true,
        deleted_at: null,
      },
      orderBy: { value: 'asc' },
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createDiscount(dto: CreateDiscountDto, restaurantId: string) {
    // Validate PERCENTAGE value
    if (dto.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    // Unique coupon code check
    if (dto.code) {
      const existing = await this.prisma.discount.findFirst({
        where: { restaurant_id: restaurantId, code: dto.code.toUpperCase(), deleted_at: null },
      });
      if (existing) throw new ConflictException(`Coupon code "${dto.code.toUpperCase()}" already exists`);
    }

    // Validate item/category references
    if (dto.scope === 'SPECIFIC_ITEM' && dto.menu_item_id) {
      const item = await this.prisma.menuItem.findFirst({
        where: { id: dto.menu_item_id, restaurant_id: restaurantId, deleted_at: null },
      });
      if (!item) throw new BadRequestException('Menu item not found');
    }
    if (dto.scope === 'CATEGORY' && dto.category_id) {
      const cat = await this.prisma.menuCategory.findFirst({
        where: { id: dto.category_id, restaurant_id: restaurantId, deleted_at: null },
      });
      if (!cat) throw new BadRequestException('Category not found');
    }

    return this.prisma.discount.create({
      data: {
        restaurant_id:    restaurantId,
        name:             dto.name.trim(),
        description:      dto.description?.trim() || null,
        code:             dto.code?.toUpperCase().trim() || null,
        type:             dto.type as any,
        scope:            dto.scope as any,
        applied_by:       dto.applied_by as any,
        value:            dto.value,
        max_discount_cap: dto.max_discount_cap ?? null,
        min_order_amount: dto.min_order_amount ?? null,
        menu_item_id:     dto.menu_item_id ?? null,
        category_id:      dto.category_id ?? null,
        max_uses_total:   dto.max_uses_total ?? null,
        valid_until:      dto.valid_until ? new Date(dto.valid_until) : null,
        is_active:        dto.is_active ?? true,
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateDiscount(id: string, dto: UpdateDiscountDto, restaurantId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    if (dto.value !== undefined && discount.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    // Code uniqueness check (if changing code)
    if (dto.code && dto.code.toUpperCase() !== discount.code) {
      const existing = await this.prisma.discount.findFirst({
        where: { restaurant_id: restaurantId, code: dto.code.toUpperCase(), deleted_at: null, id: { not: id } },
      });
      if (existing) throw new ConflictException(`Coupon code "${dto.code.toUpperCase()}" already exists`);
    }

    return this.prisma.discount.update({
      where: { id },
      data: {
        name:             dto.name?.trim(),
        description:      dto.description?.trim() || undefined,
        code:             dto.code ? dto.code.toUpperCase().trim() : undefined,
        value:            dto.value,
        max_discount_cap: dto.max_discount_cap,
        min_order_amount: dto.min_order_amount,
        max_uses_total:   dto.max_uses_total,
        valid_until:      dto.valid_until ? new Date(dto.valid_until) : dto.valid_until === null ? null : undefined,
        is_active:        dto.is_active,
      },
    });
  }

  // ── Delete (soft) ─────────────────────────────────────────────────────────

  async deleteDiscount(id: string, restaurantId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, restaurant_id: restaurantId, deleted_at: null },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    await this.prisma.discount.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false },
    });
    return { deleted: true };
  }

  // ── Validate coupon code ───────────────────────────────────────────────────

  async validateCoupon(dto: ValidateCouponDto, restaurantId: string) {
    const discount = await this.prisma.discount.findFirst({
      where: {
        restaurant_id: restaurantId,
        code: dto.code.toUpperCase().trim(),
        applied_by: 'COUPON_CODE',
        is_active: true,
        deleted_at: null,
      },
    });

    if (!discount) throw new BadRequestException('Invalid or inactive coupon code');

    // Check expiry
    if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
      throw new BadRequestException('This coupon has expired');
    }

    // Check usage limit
    if (discount.max_uses_total !== null && discount.current_uses >= discount.max_uses_total) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    // Check minimum order amount
    const minOrder = discount.min_order_amount ? Number(discount.min_order_amount) : 0;
    if (dto.order_amount < minOrder) {
      throw new BadRequestException(
        `Minimum order amount of ₹${minOrder.toFixed(0)} required for this coupon`,
      );
    }

    // Compute discount amount
    const discountAmt = this.computeDiscountAmount(discount, dto.order_amount);

    return {
      valid: true,
      discount: {
        id:               discount.id,
        name:             discount.name,
        code:             discount.code,
        type:             discount.type,
        value:            Number(discount.value),
        scope:            discount.scope,
        max_discount_cap: discount.max_discount_cap ? Number(discount.max_discount_cap) : null,
        min_order_amount: discount.min_order_amount ? Number(discount.min_order_amount) : null,
      },
      discount_amount: discountAmt,
      message: `${discount.type === 'PERCENTAGE' ? `${Number(discount.value)}% off` : `₹${Number(discount.value)} off`} applied`,
    };
  }

  /** Compute the ₹ savings for a given discount against an order amount */
  computeDiscountAmount(discount: any, orderAmount: number): number {
    let amt = 0;
    if (discount.type === 'PERCENTAGE') {
      amt = (orderAmount * Number(discount.value)) / 100;
    } else {
      amt = Number(discount.value);
    }
    // Apply cap
    if (discount.max_discount_cap !== null && discount.max_discount_cap !== undefined) {
      amt = Math.min(amt, Number(discount.max_discount_cap));
    }
    // Never exceed the order amount
    return parseFloat(Math.min(amt, orderAmount).toFixed(2));
  }

  /** Increment usage counter after a coupon is successfully applied */
  async incrementUsage(discountId: string) {
    await this.prisma.discount.update({
      where: { id: discountId },
      data: { current_uses: { increment: 1 } },
    });
  }

  /** Generate a random readable coupon code */
  generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
