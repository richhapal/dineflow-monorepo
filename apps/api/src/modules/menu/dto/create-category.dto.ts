import { IsString, IsOptional, IsBoolean, IsInt, Min, MinLength, IsArray } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class ReorderCategoriesDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
