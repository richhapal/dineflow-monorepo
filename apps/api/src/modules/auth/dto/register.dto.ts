import { IsString, IsEmail, MinLength, Matches, IsOptional, IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@dineflow/types';

export class RegisterDto {
  @IsString() @MinLength(2) restaurant_name!: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) restaurant_slug!: string;
  @IsString() owner_name!: string;
  @IsEmail() email!: string;
  @MinLength(8) password!: string;
  @IsString() phone!: string;
  @IsString() city!: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsEnum(SubscriptionPlan) plan?: SubscriptionPlan;
}
