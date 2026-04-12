import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { SupplierEntity } from './supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager, qr: any) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager, qr);
    } finally {
      await qr.release();
    }
  }

  async list(tenantId: string, page: number, limit: number, search?: string): Promise<{ data: SupplierEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(SupplierEntity);
      const qb = repo.createQueryBuilder('s');
      if (search) {
        qb.where('s.name ILIKE :s OR s.document ILIKE :s', { s: `%${search}%` });
      }
      const [data, total] = await qb
        .orderBy('s.name', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<SupplierEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(SupplierEntity);
      const supplier = await repo.findOne({ where: { id } });
      if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
      return supplier;
    });
  }

  async create(tenantId: string, dto: CreateSupplierDto): Promise<SupplierEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(SupplierEntity);
      const supplier = repo.create({
        name: dto.name,
        document: dto.document ?? null,
        documentType: dto.documentType ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
      });
      return repo.save(supplier);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto): Promise<SupplierEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(SupplierEntity);
      const supplier = await repo.findOne({ where: { id } });
      if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
      Object.assign(supplier, dto);
      return repo.save(supplier);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager, qr) => {
      const repo = manager.getRepository(SupplierEntity);
      const supplier = await repo.findOne({ where: { id } });
      if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');
      const [{ count }] = await qr.query(
        `SELECT COUNT(*) as count FROM purchases WHERE supplier_id = $1`, [id]
      );
      if (Number(count) > 0) throw new ConflictException('Fornecedor possui compras registradas.');
      await repo.remove(supplier);
    });
  }
}
