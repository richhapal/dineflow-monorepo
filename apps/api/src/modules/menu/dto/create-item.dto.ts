import {
  IsString, IsOptional, IsBoolean, IsInt, Min, IsNumber,
  IsEnum, IsArray, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FoodType } from '@dineflow/types';

export class VariantDto {
  @IsOptional() @IsString() id?: string;          // existing cuid → update; "new-*" or absent → create
  @IsString() @MinLength(1) name!: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @IsBoolean() is_available?: boolean;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
}

export class CreateItemDto {
  @IsString() category_id!: string;
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) base_price!: number;
  @IsOptional() @IsEnum(FoodType) food_type?: FoodType;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allergens?: string[];
  @IsOptional() @IsInt() calories?: number;
  @IsOptional() @IsInt() prep_time_mins?: number;
  @IsOptional() @IsBoolean() is_available?: boolean;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsBoolean() is_bestseller?: boolean;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
}

export class UpdateItemDto {
  @IsOptional() @IsString() category_id?: string;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) base_price?: number;
  @IsOptional() @IsEnum(FoodType) food_type?: FoodType;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allergens?: string[];
  @IsOptional() @IsInt() calories?: number;
  @IsOptional() @IsInt() prep_time_mins?: number;
  @IsOptional() @IsBoolean() is_available?: boolean;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsBoolean() is_bestseller?: boolean;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}
