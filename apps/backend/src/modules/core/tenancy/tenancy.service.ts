import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TenantEntity, TenantStatus } from './tenant.entity';

interface CreateTenantInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone?: string;
  endereco?: TenantEntity['endereco'];
}

@Injectable()
export class TenancyService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
  ) {}

  generateSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  generateSlug(nomeFantasia: string): string {
    return nomeFantasia
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async createTenant(input: CreateTenantInput): Promise<TenantEntity> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const tenant = this.tenantRepo.create({
      cnpj: input.cnpj,
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia,
      telefone: input.telefone ?? null,
      endereco: input.endereco ?? null,
      slug: this.generateSlug(input.nomeFantasia),
      schemaName: 'pending',
      status: TenantStatus.TRIAL,
      trialEndsAt,
      billingAnchorDate: new Date(),
    });

    const saved = await this.tenantRepo.save(tenant);
    const schemaName = this.generateSchemaName(saved.id);
    saved.schemaName = schemaName;
    const updated = await this.tenantRepo.save(saved);

    await this.provisionSchema(schemaName);

    return updated;
  }

  private async provisionSchema(schemaName: string): Promise<void> {
    if (!/^[a-z0-9_]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    } finally {
      await qr.release();
    }
  }

  async findById(id: string): Promise<TenantEntity | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }

  async findByCnpj(cnpj: string): Promise<TenantEntity | null> {
    return this.tenantRepo.findOne({ where: { cnpj } });
  }
}
