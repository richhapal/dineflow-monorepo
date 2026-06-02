import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class SingleQROrderItemDto {
  @IsString()
  menu_item_id!: string;

  @IsString()
  @IsOptional()
  variant_id?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  addon_ids?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateSingleQROrderDto {
  @IsString()
  qr_slug!: string;

  @IsString()
  customer_name!: string;

  @IsString()
  @IsOptional()
  customer_phone?: string;

  @IsString()
  @IsOptional()
  seat_identifier?: string;

  @IsString()
  idempotency_key!: string;

  @IsString()
  @IsOptional()
  customer_lang?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleQROrderItemDto)
  items!: SingleQROrderItemDto[];
}
