import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@dineflow/types';

export class UpdateStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
  @IsOptional() @IsString() notes?: string;
}

export class ApplyDiscountDto {
  @IsString() discount_id!: string;
}
