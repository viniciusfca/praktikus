import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogPartEntity } from './catalog-part.entity';
import { CreateCatalogPartDto } from './dto/create-catalog-part.dto';

@Injectable()
export class CatalogPartsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
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

  async list(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: CatalogPartEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const qb = repo.createQueryBuilder('p');
      if (search) qb.where('p.nome ILIKE :s OR p.codigo ILIKE :s', { s: `%${search}%` });
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('p.nome', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<CatalogPartEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Peça não encontrada.');
      return item;
    });
  }

  async create(tenantId: string, dto: CreateCatalogPartDto): Promise<CatalogPartEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      return repo.save(repo.create({
        nome: dto.nome,
        codigo: dto.codigo ?? null,
        precoUnitario: dto.precoUnitario,
      }));
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateCatalogPartDto>,
  ): Promise<CatalogPartEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Peça não encontrada.');
      Object.assign(item, {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.precoUnitario !== undefined && { precoUnitario: dto.precoUnitario }),
      });
      return repo.save(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogPartEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Peça não encontrada.');
      await repo.remove(item);
    });
  }
}
