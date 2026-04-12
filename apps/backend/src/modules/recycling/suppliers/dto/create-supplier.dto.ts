import { IsString, IsOptional, Matches, IsIn, ValidateIf, MinLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos' })
  document?: string;

  @ValidateIf((o) => !!o.document)
  @IsIn(['CPF', 'CNPJ'])
  documentType?: 'CPF' | 'CNPJ';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  address?: {
    street: string;
    number: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  };
}
