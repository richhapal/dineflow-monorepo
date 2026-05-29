import { IsString, Length, Matches } from 'class-validator';

export class PinLoginDto {
  @IsString() restaurant_id!: string;
  @IsString() @Length(4, 4) @Matches(/^\d{4}$/) pin!: string;
}
