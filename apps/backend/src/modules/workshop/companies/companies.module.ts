import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { TenantEntity } from '../../core/tenancy/tenant.entity';
import { TenancyModule } from '../../core/tenancy/tenancy.module';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantEntity]),
    TenancyModule,
    MulterModule.register({ dest: join(process.cwd(), 'uploads') }),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
