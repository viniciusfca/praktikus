import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from '../auth/user.entity';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, UserEntity])],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
