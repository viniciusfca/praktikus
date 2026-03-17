import { Module } from '@nestjs/common';
import { CatalogServicesService } from './catalog-services.service';
import { CatalogServicesController } from './catalog-services.controller';

@Module({
  controllers: [CatalogServicesController],
  providers: [CatalogServicesService],
})
export class CatalogModule {}
