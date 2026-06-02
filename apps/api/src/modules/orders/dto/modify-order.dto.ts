import {
  IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemModificationDto {
  /** ID of the OrderItem to modify */
  @IsString()
  item_id!: string;

  /** New quantity — set to 0 or use is_unavailable:true to cancel */
  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  /** Mark item as out of stock / unavailable */
  @IsBoolean()
  @IsOptional()
  is_unavailable?: boolean;

  /** Optional reason shown to customer ("Ran out of stock") */
  @IsString()
  @IsOptional()
  unavailable_reason?: string;
}

export class ModifyOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemModificationDto)
  modifications!: ItemModificationDto[];

  /** Optional message to the customer explaining the changes */
  @IsString()
  @IsOptional()
  waiter_note?: string;
}
