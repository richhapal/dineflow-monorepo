import {
  IsString, IsNumber, IsOptional, IsArray, ValidateNested,
  Min, IsInt, IsPositive, ArrayMinSize, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomBillItemDto {
  @IsOptional() @IsString() menu_item_id?: string;
  @IsString() item_name!: string;
  @IsInt() @IsPositive() quantity!: number;
  @IsNumber() @Min(0) unit_price!: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateCustomBillDto {
  @IsOptional() @IsString() customer_name?: string;
  @IsOptional() @IsString() customer_phone?: string;
  @IsOptional() @IsString() customer_gstin?: string;

  @IsOptional() @IsString() table_id?: string;

  @IsOptional()
  @IsIn(['DINE_IN', 'TAKEAWAY', 'WAITER_PLACED', 'ROOM_SERVICE'])
  order_type?: string;

  @IsOptional() @IsInt() @IsPositive() covers?: number;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomBillItemDto)
  items!: CustomBillItemDto[];

  @IsOptional() @IsNumber() @Min(0) discount_amount?: number;

  @IsOptional()
  @IsIn(['CASH', 'UPI', 'CARD', 'ONLINE', 'COMPLIMENTARY'])
  payment_method?: string;

  @IsOptional() @IsString() upi_txn_id?: string;
  @IsOptional() @IsString() gateway_ref?: string;
  @IsOptional() @IsString() payment_notes?: string;
}
