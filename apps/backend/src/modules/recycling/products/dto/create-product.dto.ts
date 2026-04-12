import { IsString, IsUUID, IsNumber, IsPositive } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  unitId: string;

  @IsNumber()
  @IsPositive()
  pricePerUnit: number;
}
