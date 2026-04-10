import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { BuyerEntity } from './buyer.entity';
import { CreateBuyerDto } from './dto/create-buyer.dto';
import { UpdateBuyerDto } from './dto/update-buyer.dto';

@Injectable()
export class BuyersService {
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
    await qr.startTransaction();
    try {
      await qr.query(`SET LOCAL search_path TO "${schemaName}", public`);
      const result = await fn(qr.manager, qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async list(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: BuyerEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(BuyerEntity);
      const qb = repo.createQueryBuilder('b');
      if (search) {
        qb.where('b.name ILIKE :s', { s: `%${search}%` });
      }
      const [data, total] = await qb
        .orderBy('b.name', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<BuyerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(BuyerEntity);
      const buyer = await repo.findOne({ where: { id } });
      if (!buyer) throw new NotFoundException('Comprador não encontrado.');
      return buyer;
    });
  }

  async create(tenantId: string, dto: CreateBuyerDto): Promise<BuyerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(BuyerEntity);
      const buyer = repo.create({
        name: dto.name,
        cnpj: dto.cnpj ?? null,
        phone: dto.phone ?? null,
        contactName: dto.contactName ?? null,
      });
      return repo.save(buyer);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBuyerDto): Promise<BuyerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(BuyerEntity);
      const buyer = await repo.findOne({ where: { id } });
      if (!buyer) throw new NotFoundException('Comprador não encontrado.');
      Object.assign(buyer, dto);
      return repo.save(buyer);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager, qr) => {
      const repo = manager.getRepository(BuyerEntity);
      const buyer = await repo.findOne({ where: { id } });
      if (!buyer) throw new NotFoundException('Comprador não encontrado.');
      const [{ count }] = await qr.query(
        `SELECT COUNT(*) as count FROM sales WHERE buyer_id = $1`,
        [id],
      );
      if (Number(count) > 0) throw new ConflictException('Comprador possui vendas registradas.');
      await repo.remove(buyer);
    });
  }
}
