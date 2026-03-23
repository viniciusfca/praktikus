import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
export class CreateSoItemServiceDto {
  @IsUUID() catalogServiceId: string;
  @IsString() @MinLength(1) nomeServico: string;
  @IsNumber() @Min(0) valor: number;
  @IsOptional() @IsUUID() mecanicoId?: string;
}
