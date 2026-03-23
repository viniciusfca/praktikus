import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateServiceOrderDto {
  @IsUUID() clienteId: string;
  @IsUUID() veiculoId: string;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsString() kmEntrada?: string;
  @IsOptional() @IsString() combustivel?: string;
  @IsOptional() @IsString() observacoesEntrada?: string;
}
