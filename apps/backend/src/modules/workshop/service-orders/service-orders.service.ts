import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';
import { ServiceOrderEntity } from './service-order.entity';
import { SoItemServiceEntity } from './so-item-service.entity';
import { SoItemPartEntity } from './so-item-part.entity';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { CreateSoItemServiceDto } from './dto/create-so-item-service.dto';
import { CreateSoItemPartDto } from './dto/create-so-item-part.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  ORCAMENTO: ['APROVADO'],
  APROVADO: ['EM_EXECUCAO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'FINALIZADA'],
  AGUARDANDO_PECA: ['EM_EXECUCAO'],
  FINALIZADA: ['ENTREGUE'],
  ENTREGUE: [],
};

// Statuses an EMPLOYEE can transition FROM
const EMPLOYEE_ALLOWED_FROM = ['ORCAMENTO', 'EM_EXECUCAO'];

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(tenantId: string, fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  private getSoRepo(qr: QueryRunner) { return qr.manager.getRepository(ServiceOrderEntity); }
  private getItemServiceRepo(qr: QueryRunner) { return qr.manager.getRepository(SoItemServiceEntity); }
  private getItemPartRepo(qr: QueryRunner) { return qr.manager.getRepository(SoItemPartEntity); }

  async list(
    tenantId: string,
    params: { status?: string; dateStart?: string; dateEnd?: string },
  ): Promise<ServiceOrderEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const qb = this.getSoRepo(qr).createQueryBuilder('so').orderBy('so.createdAt', 'DESC');
      if (params.status) qb.andWhere('so.status = :status', { status: params.status });
      if (params.dateStart) qb.andWhere('so.createdAt >= :dateStart', { dateStart: params.dateStart });
      if (params.dateEnd) qb.andWhere('so.createdAt <= :dateEnd', { dateEnd: params.dateEnd });
      return qb.getMany();
    });
  }

  async getById(tenantId: string, id: string) {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const itemsServices = await this.getItemServiceRepo(qr).find({ where: { soId: id } });
      const itemsParts = await this.getItemPartRepo(qr).find({ where: { soId: id } });
      return { ...so, itemsServices, itemsParts };
    });
  }

  async create(tenantId: string, dto: CreateServiceOrderDto): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      return repo.save(repo.create({
        clienteId: dto.clienteId,
        veiculoId: dto.veiculoId,
        appointmentId: dto.appointmentId ?? null,
        kmEntrada: dto.kmEntrada ?? null,
        combustivel: dto.combustivel ?? null,
        observacoesEntrada: dto.observacoesEntrada ?? null,
      }));
    });
  }

  async update(tenantId: string, id: string, dto: UpdateServiceOrderDto): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      if (dto.kmEntrada !== undefined) so.kmEntrada = dto.kmEntrada;
      if (dto.combustivel !== undefined) so.combustivel = dto.combustivel;
      if (dto.observacoesEntrada !== undefined) so.observacoesEntrada = dto.observacoesEntrada;
      return repo.save(so);
    });
  }

  async patchStatus(
    tenantId: string,
    id: string,
    newStatus: string,
    userRole: string,
  ): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');

      if (!EMPLOYEE_ALLOWED_FROM.includes(so.status) && userRole !== 'OWNER') {
        throw new BadRequestException('Permissão insuficiente para esta transição.');
      }
      const allowed = VALID_TRANSITIONS[so.status] ?? [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(`Transição de ${so.status} para ${newStatus} não permitida.`);
      }

      so.status = newStatus;
      if (newStatus === 'APROVADO') {
        so.approvalToken = null;
        so.approvalExpiresAt = null;
      }
      return repo.save(so);
    });
  }

  async patchPaymentStatus(tenantId: string, id: string, statusPagamento: string): Promise<ServiceOrderEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      so.statusPagamento = statusPagamento;
      return repo.save(so);
    });
  }

  async generateApprovalToken(tenantId: string, id: string): Promise<{ token: string; expiresAt: Date }> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getSoRepo(qr);
      const so = await repo.findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      if (so.status !== 'ORCAMENTO') {
        throw new BadRequestException('Link só pode ser gerado com status ORCAMENTO.');
      }
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      so.approvalToken = token;
      so.approvalExpiresAt = expiresAt;
      await repo.save(so);
      // Record in public table for cross-tenant lookup
      await this.dataSource.query(
        `INSERT INTO public.service_order_approval_tokens (token, tenant_id, so_id, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token) DO UPDATE SET expires_at = $4, used_at = NULL`,
        [token, tenantId, id, expiresAt.toISOString()],
      );
      return { token, expiresAt };
    });
  }

  async addItemService(tenantId: string, soId: string, dto: CreateSoItemServiceDto): Promise<SoItemServiceEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id: soId } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const repo = this.getItemServiceRepo(qr);
      return repo.save(repo.create({
        soId,
        catalogServiceId: dto.catalogServiceId,
        nomeServico: dto.nomeServico,
        valor: dto.valor,
        mecanicoId: dto.mecanicoId ?? null,
      }));
    });
  }

  async removeItemService(tenantId: string, soId: string, itemId: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const item = await this.getItemServiceRepo(qr).findOne({ where: { id: itemId, soId } });
      if (!item) throw new NotFoundException('Item não encontrado.');
      await this.getItemServiceRepo(qr).remove(item);
    });
  }

  async addItemPart(tenantId: string, soId: string, dto: CreateSoItemPartDto): Promise<SoItemPartEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id: soId } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const repo = this.getItemPartRepo(qr);
      return repo.save(repo.create({
        soId,
        catalogPartId: dto.catalogPartId,
        nomePeca: dto.nomePeca,
        quantidade: dto.quantidade,
        valorUnitario: dto.valorUnitario,
      }));
    });
  }

  async removeItemPart(tenantId: string, soId: string, itemId: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const item = await this.getItemPartRepo(qr).findOne({ where: { id: itemId, soId } });
      if (!item) throw new NotFoundException('Item não encontrado.');
      await this.getItemPartRepo(qr).remove(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const so = await this.getSoRepo(qr).findOne({ where: { id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      if (so.approvalToken) {
        await this.dataSource.query(
          `DELETE FROM public.service_order_approval_tokens WHERE so_id = $1`,
          [id],
        );
      }
      await this.getSoRepo(qr).remove(so);
    });
  }
}
