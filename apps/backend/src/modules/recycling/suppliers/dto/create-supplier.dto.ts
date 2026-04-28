import {
  IsString,
  IsOptional,
  IsIn,
  ValidateIf,
  MinLength,
} from 'class-validator';
import { IsValidDocument } from '../../../core/validation';

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsValidDocument()
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
    neighborhood?: string;
    complement?: string;
    city: string;
    state: string;
    zip: string;
  };
}
