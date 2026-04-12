import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ProductEntity } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
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

  async list(tenantId: string, includeInactive = false): Promise<ProductEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const qb = repo.createQueryBuilder('product').orderBy('product.name', 'ASC');
      if (!includeInactive) {
        qb.where('product.active = :active', { active: true });
      }
      return qb.getMany();
    });
  }

  async getById(tenantId: string, id: string): Promise<ProductEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const product = await repo.findOne({ where: { id } });
      if (!product) throw new NotFoundException('Produto não encontrado.');
      return product;
    });
  }

  async create(tenantId: string, dto: CreateProductDto): Promise<ProductEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const product = repo.create({
        name: dto.name,
        unitId: dto.unitId,
        pricePerUnit: dto.pricePerUnit,
        active: true,
      });
      return repo.save(product);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const product = await repo.findOne({ where: { id } });
      if (!product) throw new NotFoundException('Produto não encontrado.');
      Object.assign(product, dto);
      return repo.save(product);
    });
  }
}
