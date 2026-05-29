import {
  IsString, IsOptional, IsEnum, IsInt, IsUUID,
  IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@dineflow/types';

export class CreateOrderItemDto {
  @IsString() menu_item_id!: string;
  @IsOptional() @IsString() variant_id?: string;
  @IsInt() @Min(1) @Max(20) quantity!: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) addon_ids?: string[];
}

export class CreateOrderDto {
  @IsOptional() @IsString() table_id?: string;
  @IsOptional() @IsString() room_id?: string;
  @IsEnum(OrderType) order_type!: OrderType;
  @IsOptional() @IsString() customer_name?: string;
  @IsOptional() @IsString() customer_phone?: string;
  @IsOptional() @IsString() customer_lang?: string;
  @IsOptional() @IsInt() @Min(1) covers?: number;
  @IsOptional() @IsString() notes?: string;
  @IsUUID() idempotency_key!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) items!: CreateOrderItemDto[];
}
