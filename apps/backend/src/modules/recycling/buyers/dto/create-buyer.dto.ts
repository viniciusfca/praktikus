import { IsString, IsOptional, IsIn, ValidateIf, MinLength } from 'class-validator';
import { IsValidDocument } from '../../../core/validation';

export class CreateBuyerDto {
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
  @IsString()
  contactName?: string;
}
