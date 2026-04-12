import { IsString, IsOptional, Matches, MinLength } from 'class-validator';

export class CreateBuyerDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 dígitos' }) cnpj?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
}
