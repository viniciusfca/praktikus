import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenancyService } from '../../core/tenancy/tenancy.service';
import { TenantEntity } from '../../core/tenancy/tenant.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly tenancyService: TenancyService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
  ) {}

  async getProfile(tenantId: string): Promise<TenantEntity> {
    const tenant = await this.tenancyService.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Oficina não encontrada.');
    }
    return tenant;
  }

  async updateProfile(tenantId: string, dto: UpdateCompanyDto): Promise<TenantEntity> {
    const tenant = await this.getProfile(tenantId);
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  async updateLogo(tenantId: string, logoUrl: string): Promise<TenantEntity> {
    const tenant = await this.getProfile(tenantId);
    tenant.logoUrl = logoUrl;
    return this.tenantRepo.save(tenant);
  }
}
