import { IsBoolean, IsOptional, IsString, IsDateString } from 'class-validator';

export class PauseOrderingDto {
  @IsBoolean()
  paused!: boolean;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  pause_until?: string; // ISO date string, optional auto-resume time
}
