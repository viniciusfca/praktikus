import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenantSegment } from '@praktikus/shared';
import { IsValidCnpj, IsStrongPassword } from '../../validation';

export class AddressDto {
  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  city: string;

  @IsString()
  @MaxLength(2)
  state: string;

  @IsString()
  @Matches(/^\d{5}-?\d{3}$/)
  zip: string;
}

export class RegisterDto {
  @IsValidCnpj()
  cnpj: string;

  @IsString()
  @MinLength(3)
  razaoSocial: string;

  @IsString()
  @MinLength(2)
  nomeFantasia: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  endereco?: AddressDto;

  @IsEmail()
  email: string;

  @IsStrongPassword()
  password: string;

  @IsString()
  ownerName: string;

  @IsOptional()
  @IsEnum(TenantSegment)
  segment?: TenantSegment;
}
