import { IsIn } from 'class-validator';
import { ColetaStatus } from '@praktikus/shared';

export class UpdateColetaStatusDto {
  @IsIn([ColetaStatus.CONCLUIDA, ColetaStatus.CANCELADA])
  status: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA;
}
