import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogServiceEntity } from './catalog-service.entity';
import { CreateCatalogServiceDto } from './dto/create-catalog-service.dto';

@Injectable()
export class CatalogServicesService {
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
  ): Promise<{ data: CatalogServiceEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const qb = repo.createQueryBuilder('s');
      if (search) qb.where('s.nome ILIKE :s', { s: `%${search}%` });
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('s.nome', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<CatalogServiceEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Serviço não encontrado.');
      return item;
    });
  }

  async create(tenantId: string, dto: CreateCatalogServiceDto): Promise<CatalogServiceEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      return repo.save(repo.create({
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        precoPadrao: dto.precoPadrao,
      }));
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateCatalogServiceDto>,
  ): Promise<CatalogServiceEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Serviço não encontrado.');
      Object.assign(item, {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.precoPadrao !== undefined && { precoPadrao: dto.precoPadrao }),
      });
      return repo.save(item);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CatalogServiceEntity);
      const item = await repo.findOne({ where: { id } });
      if (!item) throw new NotFoundException('Serviço não encontrado.');
      await repo.remove(item);
    });
  }
}
