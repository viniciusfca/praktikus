import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner, In } from 'typeorm';
import { ProductEntity } from './product.entity';
import { ProductPriceEntity } from './product-price.entity';
import { PriceTableEntity } from '../price-tables/price-table.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductWithPrices = ProductEntity & {
  prices: Record<string, number | null>;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    ) {
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

  private async withTransaction<T>(
    tenantId: string,
    fn: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.query(`SET search_path TO "${schemaName}", public`);
    await qr.startTransaction();
    try {
      const result = await fn(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Carrega tabelas ativas e valida o mapa de preços do payload.
   * Retorna a tabela padrão para uso a seguir.
   */
  private async validatePriceMap(
    manager: EntityManager,
    prices: Record<string, number | null>,
  ): Promise<{ defaultTable: PriceTableEntity; tables: PriceTableEntity[] }> {
    const tables = await manager
      .getRepository(PriceTableEntity)
      .find({ where: { active: true } });
    const tablesById = new Map(tables.map((t) => [t.id, t]));
    const defaultTable = tables.find((t) => t.isDefault);
    if (!defaultTable) {
      throw new Error('Tabela padrão não configurada');
    }

    // Toda chave deve corresponder a uma tabela ativa.
    for (const id of Object.keys(prices)) {
      if (!tablesById.has(id)) {
        throw new BadRequestException(
          `Tabela de preço ${id} não existe ou está inativa`,
        );
      }
    }
    // Tabela padrão obrigatória com valor > 0.
    const defValue = prices[defaultTable.id];
    if (typeof defValue !== 'number' || defValue <= 0) {
      throw new BadRequestException(
        `Preço da Tabela 1 (Padrão) é obrigatório e deve ser maior que zero`,
      );
    }
    return { defaultTable, tables };
  }

  private async loadPricesMap(
    manager: EntityManager,
    productIds: string[],
  ): Promise<Map<string, Record<string, number | null>>> {
    if (productIds.length === 0) return new Map();
    const tables = await manager
      .getRepository(PriceTableEntity)
      .find({ where: { active: true } });
    const tableIds = tables.map((t) => t.id);

    const entries = await manager.getRepository(ProductPriceEntity).find({
      where: { productId: In(productIds) },
    });

    const result = new Map<string, Record<string, number | null>>();
    for (const pid of productIds) {
      const map: Record<string, number | null> = {};
      for (const tid of tableIds) map[tid] = null;
      result.set(pid, map);
    }
    for (const e of entries) {
      const map = result.get(e.productId);
      if (map) map[e.priceTableId] = Number(e.price);
    }
    return result;
  }

  async list(
    tenantId: string,
    includeInactive = false,
  ): Promise<ProductWithPrices[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const qb = repo
        .createQueryBuilder('product')
        .orderBy('product.name', 'ASC');
      if (!includeInactive) {
        qb.where('product.active = :active', { active: true });
      }
      const products = await qb.getMany();
      const pricesByProduct = await this.loadPricesMap(
        manager,
        products.map((p) => p.id),
      );
      return products.map((p) => ({
        ...p,
        prices: pricesByProduct.get(p.id) ?? {},
      }));
    });
  }

  async getById(tenantId: string, id: string): Promise<ProductWithPrices> {
    return this.withSchema(tenantId, async (manager) => {
      const product = await manager
        .getRepository(ProductEntity)
        .findOne({ where: { id } });
      if (!product) throw new NotFoundException('Produto não encontrado.');
      const pricesByProduct = await this.loadPricesMap(manager, [id]);
      return { ...product, prices: pricesByProduct.get(id) ?? {} };
    });
  }

  async create(
    tenantId: string,
    dto: CreateProductDto,
  ): Promise<ProductWithPrices> {
    return this.withTransaction(tenantId, async (qr) => {
      const { manager } = qr;
      const { defaultTable } = await this.validatePriceMap(manager, dto.prices);

      const product = manager.getRepository(ProductEntity).create({
        name: dto.name,
        unitId: dto.unitId,
        pricePerUnit: dto.prices[defaultTable.id] as number,
        active: dto.active ?? true,
      });
      const saved = await manager.getRepository(ProductEntity).save(product);

      for (const [tableId, price] of Object.entries(dto.prices)) {
        if (price === null) continue;
        await manager.getRepository(ProductPriceEntity).upsert(
          {
            productId: saved.id,
            priceTableId: tableId,
            price: price,
          },
          ['productId', 'priceTableId'],
        );
      }

      const pricesByProduct = await this.loadPricesMap(manager, [saved.id]);
      return { ...saved, prices: pricesByProduct.get(saved.id) ?? {} };
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductWithPrices> {
    return this.withTransaction(tenantId, async (qr) => {
      const { manager } = qr;
      const productRepo = manager.getRepository(ProductEntity);
      const product = await productRepo.findOne({ where: { id } });
      if (!product) throw new NotFoundException('Produto não encontrado.');

      // Aplica campos simples
      if (dto.name !== undefined) product.name = dto.name;
      if (dto.unitId !== undefined) product.unitId = dto.unitId;
      if (dto.active !== undefined) product.active = dto.active;

      if (dto.prices !== undefined) {
        const { defaultTable } = await this.validatePriceMap(
          manager,
          dto.prices,
        );

        for (const [tableId, price] of Object.entries(dto.prices)) {
          if (price === null) {
            await manager
              .getRepository(ProductPriceEntity)
              .delete({ productId: id, priceTableId: tableId });
          } else {
            await manager.getRepository(ProductPriceEntity).upsert(
              { productId: id, priceTableId: tableId, price: price },
              ['productId', 'priceTableId'],
            );
          }
        }
        product.pricePerUnit = dto.prices[defaultTable.id] as number;
      }

      const saved = await productRepo.save(product);
      const pricesByProduct = await this.loadPricesMap(manager, [id]);
      return { ...saved, prices: pricesByProduct.get(id) ?? {} };
    });
  }
}
