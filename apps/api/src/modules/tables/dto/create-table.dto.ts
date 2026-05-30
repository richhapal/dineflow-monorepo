import {
  IsString, IsOptional, IsBoolean, IsInt, Min, IsEnum, MinLength,
} from 'class-validator';

export enum TableType {
  INDOOR  = 'INDOOR',
  OUTDOOR = 'OUTDOOR',
  BAR     = 'BAR',
  PRIVATE = 'PRIVATE',
}

export class CreateTableDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() section?: string;
  @IsInt() @Min(1) capacity!: number;
  @IsOptional() @IsEnum(TableType) table_type?: TableType;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() generate_qr?: boolean;
}

export class BulkCreateTableDto {
  @IsString() @MinLength(1) name_prefix!: string;   // e.g. "T-"
  @IsInt() @Min(1) count!: number;                  // how many
  @IsInt() @Min(1) start_index!: number;            // start numbering from
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(TableType) table_type?: TableType;
  @IsOptional() @IsBoolean() generate_qr?: boolean;
}

export class UpdateTableDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(TableType) table_type?: TableType;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateTableStatusDto {
  @IsString() status!: string;
}
