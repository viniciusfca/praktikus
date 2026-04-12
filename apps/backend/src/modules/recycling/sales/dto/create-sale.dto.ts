import { IsArray, ArrayMinSize, IsOptional, IsPositive, IsNumber, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SaleItemDto {
  @IsUUID() productId: string;
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() quantity: number;
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() unitPrice: number;
}

export class CreateSaleDto {
  @IsUUID() buyerId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[];
  @IsOptional() @IsString() notes?: string;
}
