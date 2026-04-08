import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UnitEntity } from './unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager) => Promise<T>): Promise<T> {
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

  async list(tenantId: string): Promise<UnitEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(UnitEntity);
      return repo.find();
    });
  }

  async create(tenantId: string, dto: CreateUnitDto): Promise<UnitEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(UnitEntity);
      const unit = repo.create(dto);
      return repo.save(unit);
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateUnitDto>): Promise<UnitEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(UnitEntity);
      const unit = await repo.findOne({ where: { id } });
      if (!unit) throw new NotFoundException('Unidade não encontrada.');
      Object.assign(unit, dto);
      return repo.save(unit);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const repo = qr.manager.getRepository(UnitEntity);
      const unit = await repo.findOne({ where: { id } });
      if (!unit) throw new NotFoundException('Unidade não encontrada.');
      const [{ count }] = await qr.query(
        `SELECT COUNT(*) as count FROM products WHERE unit_id = $1`, [id]
      );
      if (Number(count) > 0) throw new ConflictException('Unidade possui produtos cadastrados.');
      await repo.remove(unit);
    } finally {
      await qr.release();
    }
  }
}
