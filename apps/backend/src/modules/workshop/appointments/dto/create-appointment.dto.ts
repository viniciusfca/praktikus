import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  clienteId: string;

  @IsUUID()
  veiculoId: string;

  @IsDateString()
  dataHora: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  duracaoMin?: number;

  @IsOptional()
  @IsString()
  tipoServico?: string;

  @IsOptional()
  @IsIn(['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'])
  status?: string;
}
