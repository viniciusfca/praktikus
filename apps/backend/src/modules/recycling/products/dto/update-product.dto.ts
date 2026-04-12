import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsNumber() @IsPositive() pricePerUnit?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
