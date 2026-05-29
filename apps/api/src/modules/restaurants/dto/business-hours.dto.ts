import { IsInt, IsString, IsBoolean, IsOptional, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BusinessHourDto {
  @IsInt() @Min(0) @Max(6) day_of_week!: number; // 0=Sun
  @IsBoolean() is_open!: boolean;
  @IsString() open_time!: string;   // "09:00"
  @IsString() close_time!: string;  // "23:00"
  @IsOptional() @IsBoolean() has_break?: boolean;
  @IsOptional() @IsString() break_start?: string;
  @IsOptional() @IsString() break_end?: string;
}

export class UpsertBusinessHoursDto {
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours!: BusinessHourDto[];
}
