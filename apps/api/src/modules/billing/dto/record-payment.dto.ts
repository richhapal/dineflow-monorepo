import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@dineflow/types';

export class RecordPaymentDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() gateway_ref?: string;
  @IsOptional() @IsString() upi_txn_id?: string;
  @IsOptional() @IsString() notes?: string;
}
