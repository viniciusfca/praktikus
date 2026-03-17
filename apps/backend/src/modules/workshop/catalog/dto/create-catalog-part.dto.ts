import { IsString, IsOptional, IsNumber, Min, MinLength } from 'class-validator';

export class CreateCatalogPartDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsNumber()
  @Min(0)
  precoUnitario: number;
}
