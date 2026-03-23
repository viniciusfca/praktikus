import { IsInt, IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';
export class CreateSoItemPartDto {
  @IsUUID() catalogPartId: string;
  @IsString() @MinLength(1) nomePeca: string;
  @IsInt() @Min(1) quantidade: number;
  @IsNumber() @Min(0) valorUnitario: number;
}
