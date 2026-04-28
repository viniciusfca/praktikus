import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateColetaDto {
  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
