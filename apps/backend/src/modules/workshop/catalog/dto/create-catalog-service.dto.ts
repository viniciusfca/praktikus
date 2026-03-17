import { IsString, IsOptional, IsNumber, Min, MinLength } from 'class-validator';

export class CreateCatalogServiceDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  @Min(0)
  precoPadrao: number;
}
