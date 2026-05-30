import { IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';

export class CreateQRDto {
  @IsString() label!: string;
  @IsOptional() @IsString() table_id?: string;
  @IsOptional() @IsString() room_id?: string;
  @IsOptional() @IsString() slug?: string;
}

export class BulkCreateQRDto {
  // New format: list of table IDs (from the Tables & QR dashboard)
  @IsOptional() @IsArray() @IsString({ each: true }) tableIds?: string[];
  // Legacy format (kept for backward compat)
  @IsOptional() @IsInt() @Min(1) count?: number;
  @IsOptional() @IsString() prefix?: string;
}
