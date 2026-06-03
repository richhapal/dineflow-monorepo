import {
  IsString, IsNumber, IsOptional, IsBoolean, IsInt,
  IsIn, IsPositive, Min,
} from 'class-validator';

export const DISCOUNT_TYPES   = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export const DISCOUNT_SCOPES  = ['ENTIRE_ORDER', 'SPECIFIC_ITEM', 'CATEGORY'] as const;
export const APPLIED_BY_OPTS  = ['WAITER_MANUAL', 'COUPON_CODE', 'CUSTOMER_AUTO'] as const;

export class CreateDiscountDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;

  /** Coupon code — only used when applied_by = COUPON_CODE */
  @IsOptional() @IsString() code?: string;

  @IsIn(DISCOUNT_TYPES)   type!: string;
  @IsIn(DISCOUNT_SCOPES)  scope!: string;
  @IsIn(APPLIED_BY_OPTS)  applied_by!: string;

  /**
   * For PERCENTAGE: 0–100 (stored as-is, e.g. 10 = 10%)
   * For FIXED_AMOUNT: ₹ amount ≥ 0
   */
  @IsNumber() @Min(0) value!: number;

  /** Cap the ₹ saved even when % discount is large */
  @IsOptional() @IsNumber() @Min(0) max_discount_cap?: number;
  /** Minimum cart subtotal to qualify */
  @IsOptional() @IsNumber() @Min(0) min_order_amount?: number;

  /** SPECIFIC_ITEM scope */
  @IsOptional() @IsString() menu_item_id?: string;
  /** CATEGORY scope */
  @IsOptional() @IsString() category_id?: string;

  /** How many times this can be used total (null = unlimited) */
  @IsOptional() @IsInt() @IsPositive() max_uses_total?: number;

  /** ISO date string — null = no expiry */
  @IsOptional() @IsString() valid_until?: string;

  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateDiscountDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsNumber() @Min(0) max_discount_cap?: number;
  @IsOptional() @IsNumber() @Min(0) min_order_amount?: number;
  @IsOptional() @IsInt() @IsPositive() max_uses_total?: number;
  @IsOptional() @IsString() valid_until?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsString() code?: string;
}

export class ValidateCouponDto {
  @IsString() code!: string;
  @IsNumber() @Min(0) order_amount!: number;
}
