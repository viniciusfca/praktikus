import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPriceMap } from '../../../../common/validators/price-map.validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsUUID()
  unitId: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsObject()
  @IsPriceMap()
  prices: Record<string, number | null>;
}
