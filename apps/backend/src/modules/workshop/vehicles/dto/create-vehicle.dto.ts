import { IsString, IsInt, IsUUID, Min, Max, Matches } from 'class-validator';

export class CreateVehicleDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @Matches(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, {
    message: 'Placa inválida. Use formato ABC1234 (antigo) ou ABC1D23 (Mercosul)',
  })
  placa: string;

  @IsString()
  marca: string;

  @IsString()
  modelo: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  ano: number;

  @IsInt()
  @Min(0)
  km: number;
}
