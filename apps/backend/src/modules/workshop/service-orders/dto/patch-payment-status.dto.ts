import { IsIn } from 'class-validator';
export class PatchPaymentStatusDto {
  @IsIn(['PENDENTE', 'PAGO']) statusPagamento: string;
}
