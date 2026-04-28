import { IsArray, ArrayMinSize, IsEnum, IsOptional, IsPositive, IsNumber, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@praktikus/shared';

export class SaleItemDto {
  @IsUUID() productId: string;
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() quantity: number;
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() unitPrice: number;
}

export class CreateSaleDto {
  @IsUUID() buyerId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[];
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() notes?: string;
}
