import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateThemeDto {
  @IsOptional() @IsString() active_theme_id?: string;
  @IsOptional() @IsObject() theme_config?: Record<string, any>;
}
