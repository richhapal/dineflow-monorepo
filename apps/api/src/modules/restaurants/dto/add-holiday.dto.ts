import { IsString, IsDateString, IsOptional } from 'class-validator';

export class AddHolidayDto {
  @IsDateString() date!: string;
  @IsString() reason!: string;
  @IsOptional() @IsString() note?: string;
}
