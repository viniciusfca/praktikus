import { IsEnum, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { TransactionType, PaymentMethod } from '../cash-transaction.entity';

export class AddTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
