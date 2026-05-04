import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PriceTableEntity } from './price-table.entity';

@Injectable()
export class PriceTablesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    ) {
      throw new BadRequestException('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async list(tenantId: string): Promise<PriceTableEntity[]> {
    return this.withSchema(tenantId, (manager) =>
      manager
        .getRepository(PriceTableEntity)
        .createQueryBuilder('pt')
        .where('pt.active = :active', { active: true })
        .orderBy('pt.sortOrder', 'ASC')
        .getMany(),
    );
  }

  async getDefault(tenantId: string): Promise<PriceTableEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const def = await manager.getRepository(PriceTableEntity).findOne({
        where: { isDefault: true, active: true },
      });
      if (!def) {
        throw new NotFoundException('Tabela padrão não encontrada para o tenant');
      }
      return def;
    });
  }
}
