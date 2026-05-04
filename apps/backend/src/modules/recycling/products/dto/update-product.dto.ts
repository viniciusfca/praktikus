import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsPriceMap } from '../../../../common/validators/price-map.validator';

export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsBoolean() active?: boolean;

  @IsOptional()
  @IsObject()
  @IsPriceMap()
  prices?: Record<string, number | null>;
}
