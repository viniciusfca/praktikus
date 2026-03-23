import { IsIn } from 'class-validator';
const VALID = ['ORCAMENTO', 'APROVADO', 'EM_EXECUCAO', 'AGUARDANDO_PECA', 'FINALIZADA', 'ENTREGUE'];
export class PatchStatusDto {
  @IsIn(VALID) status: string;
}
