import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ColetaStatus } from '@praktikus/shared';
import { ColetaEntity } from './coleta.entity';
import { SupplierEntity } from '../suppliers/supplier.entity';
import { UserEntity, UserRole } from '../../core/auth/user.entity';
import { CreateColetaDto } from './dto/create-coleta.dto';
import { UpdateColetaDto } from './dto/update-coleta.dto';
import { ListColetasQueryDto } from './dto/list-coletas-query.dto';

@Injectable()
export class ColetasService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
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

  private async assertSupplier(qr: QueryRunner, supplierId: string): Promise<void> {
    const repo = qr.manager.getRepository(SupplierEntity);
    const s = await repo.findOne({ where: { id: supplierId } });
    if (!s) throw new NotFoundException('Fornecedor não encontrado.');
  }

  private async assertEmployee(
    qr: QueryRunner,
    tenantId: string,
    employeeId: string,
  ): Promise<void> {
    const repo = qr.manager.getRepository(UserEntity);
    const u = await repo.findOne({ where: { id: employeeId, tenantId } });
    if (!u) throw new NotFoundException('Funcionário não encontrado.');
    if (u.role !== UserRole.EMPLOYEE) {
      throw new BadRequestException('Motorista deve ser um funcionário.');
    }
  }

  async list(tenantId: string, query: ListColetasQueryDto): Promise<ColetaEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const qb = repo.createQueryBuilder('c').orderBy('c.scheduledAt', 'ASC');
      if (query.start) qb.andWhere('c.scheduledAt >= :start', { start: query.start });
      if (query.end) qb.andWhere('c.scheduledAt <= :end', { end: query.end });
      if (query.status) qb.andWhere('c.status = :status', { status: query.status });
      return qb.getMany();
    });
  }

  async upcoming(tenantId: string, limit: number = 4): Promise<ColetaEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      return repo.createQueryBuilder('c')
        .where('c.status = :status', { status: ColetaStatus.AGENDADA })
        .orderBy('c.scheduledAt', 'ASC')
        .limit(Math.max(1, Math.min(50, Math.floor(limit))))
        .getMany();
    });
  }

  async getById(tenantId: string, id: string): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');
      return item;
    });
  }

  async create(tenantId: string, dto: CreateColetaDto): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      await this.assertSupplier(qr, dto.supplierId);
      if (dto.employeeId) await this.assertEmployee(qr, tenantId, dto.employeeId);

      const repo = qr.manager.getRepository(ColetaEntity);
      return repo.save(
        repo.create({
          supplierId: dto.supplierId,
          employeeId: dto.employeeId ?? null,
          scheduledAt: new Date(dto.scheduledAt),
          status: ColetaStatus.AGENDADA,
          notes: dto.notes ?? null,
        }),
      );
    });
  }

  async update(tenantId: string, id: string, dto: UpdateColetaDto): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');

      if (item.status !== ColetaStatus.AGENDADA) {
        throw new BadRequestException('Só é possível editar coletas AGENDADAS.');
      }

      if (dto.supplierId) await this.assertSupplier(qr, dto.supplierId);
      if (dto.employeeId) await this.assertEmployee(qr, tenantId, dto.employeeId);

      if (dto.supplierId !== undefined) item.supplierId = dto.supplierId;
      if (dto.employeeId !== undefined) item.employeeId = dto.employeeId ?? null;
      if (dto.scheduledAt !== undefined) item.scheduledAt = new Date(dto.scheduledAt);
      if (dto.notes !== undefined) item.notes = dto.notes ?? null;

      return repo.save(item);
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    nextStatus: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA,
  ): Promise<ColetaEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');
      if (item.status !== ColetaStatus.AGENDADA) {
        throw new BadRequestException('Só é possível alterar status de coletas AGENDADAS.');
      }
      item.status = nextStatus;
      return repo.save(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Coleta não encontrada.');
      if (item.status !== ColetaStatus.AGENDADA) {
        throw new BadRequestException('Só é possível deletar coletas AGENDADAS. Use cancelar para estados finais.');
      }
      await repo.remove(item);
    });
  }
}
