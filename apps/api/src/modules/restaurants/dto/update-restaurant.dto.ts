import { IsString, IsOptional, IsBoolean, IsEmail, IsNumber, Min, Max } from 'class-validator';

export class UpdateRestaurantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) gst_rate?: number;
  @IsOptional() @IsString() upi_id?: string;
  @IsOptional() @IsBoolean() is_ordering_enabled?: boolean;
  @IsOptional() @IsBoolean() auto_accept_orders?: boolean;
  @IsOptional() @IsBoolean() whatsapp_bill?: boolean;
  @IsOptional() @IsBoolean() sms_bill?: boolean;
}
