import { IsEnum, IsUUID, IsOptional, IsString, IsArray, ValidateNested, IsNumber, IsPositive, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@praktikus/shared';

export class PurchaseItemDto {
  @IsUUID()
  productId: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Max(999999.9999)
  unitPrice: number;
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
