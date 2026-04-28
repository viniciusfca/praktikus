import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { IsValidDocument } from '../../../core/validation';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsValidDocument()
  cpfCnpj: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
