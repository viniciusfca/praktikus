import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { AppointmentEntity } from './appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
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

  private async findConflicts(
    qr: QueryRunner,
    dataHora: string,
    duracaoMin: number,
    excludeId?: string,
  ): Promise<Array<{ id: string; data_hora: Date; tipo_servico: string | null }>> {
    const startTime = new Date(dataHora);
    const endTime = new Date(startTime.getTime() + duracaoMin * 60 * 1000);
    const excludeUuid = excludeId ?? '00000000-0000-0000-0000-000000000000';
    return qr.query(
      `SELECT id, data_hora, tipo_servico FROM appointments
       WHERE status NOT IN ('CANCELADO', 'CONCLUIDO')
         AND id != $1
         AND data_hora < $2
         AND (data_hora + (duracao_min * interval '1 minute')) > $3`,
      [excludeUuid, endTime.toISOString(), startTime.toISOString()],
    );
  }

  private getRepo(qr: QueryRunner) {
    return qr.manager.getRepository(AppointmentEntity);
  }

  async list(
    tenantId: string,
    params: { dateStart?: string; dateEnd?: string; status?: string },
  ): Promise<AppointmentEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getRepo(qr);
      const qb = repo.createQueryBuilder('a').orderBy('a.dataHora', 'ASC');
      if (params.dateStart) qb.andWhere('a.dataHora >= :dateStart', { dateStart: params.dateStart });
      if (params.dateEnd) qb.andWhere('a.dataHora <= :dateEnd', { dateEnd: params.dateEnd });
      if (params.status) qb.andWhere('a.status = :status', { status: params.status });
      return qb.getMany();
    });
  }

  async getById(tenantId: string, id: string): Promise<AppointmentEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getRepo(qr);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Agendamento não encontrado.');
      return item;
    });
  }

  async create(
    tenantId: string,
    dto: CreateAppointmentDto,
  ): Promise<{ data: AppointmentEntity; conflicts: any[] }> {
    return this.withSchema(tenantId, async (qr) => {
      const duracaoMin = dto.duracaoMin ?? 60;
      const conflicts = await this.findConflicts(qr, dto.dataHora, duracaoMin);
      const repo = this.getRepo(qr);
      const item = await repo.save(
        repo.create({
          clienteId: dto.clienteId,
          veiculoId: dto.veiculoId,
          dataHora: new Date(dto.dataHora),
          duracaoMin,
          tipoServico: dto.tipoServico ?? null,
          status: dto.status ?? 'PENDENTE',
        }),
      );
      return { data: item, conflicts };
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateAppointmentDto>,
  ): Promise<{ data: AppointmentEntity; conflicts: any[] }> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getRepo(qr);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Agendamento não encontrado.');

      let conflicts: any[] = [];
      if (dto.dataHora !== undefined || dto.duracaoMin !== undefined) {
        const newDataHora = dto.dataHora ?? item.dataHora.toISOString();
        const newDuracao = dto.duracaoMin ?? item.duracaoMin;
        conflicts = await this.findConflicts(qr, newDataHora, newDuracao, id);
      }

      Object.assign(item, {
        ...(dto.clienteId !== undefined && { clienteId: dto.clienteId }),
        ...(dto.veiculoId !== undefined && { veiculoId: dto.veiculoId }),
        ...(dto.dataHora !== undefined && { dataHora: new Date(dto.dataHora) }),
        ...(dto.duracaoMin !== undefined && { duracaoMin: dto.duracaoMin }),
        ...(dto.tipoServico !== undefined && { tipoServico: dto.tipoServico }),
        ...(dto.status !== undefined && { status: dto.status }),
      });

      const updated = await repo.save(item);
      return { data: updated, conflicts };
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = this.getRepo(qr);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Agendamento não encontrado.');
      await repo.remove(item);
    });
  }
}
