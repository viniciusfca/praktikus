import { IsEnum, IsNumber, IsPositive, IsOptional, IsString, Max } from 'class-validator';
import { TransactionType, PaymentMethod } from '@praktikus/shared';

export class AddTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(999999.99)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
