import { IsString, IsEmail, IsOptional, MinLength, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos numéricos',
  })
  cpfCnpj: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
