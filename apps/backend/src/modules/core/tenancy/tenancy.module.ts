import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './tenant.entity';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
