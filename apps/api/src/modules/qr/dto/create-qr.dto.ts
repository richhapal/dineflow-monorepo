import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateQRDto {
  @IsString() label!: string;
  @IsOptional() @IsString() table_id?: string;
  @IsOptional() @IsString() room_id?: string;
  @IsOptional() @IsString() slug?: string;
}

export class BulkCreateQRDto {
  @IsInt() @Min(1) count!: number;
  @IsString() prefix!: string;
}
