import { Module } from '@nestjs/common';
import { CatalogServicesService } from './catalog-services.service';
import { CatalogServicesController } from './catalog-services.controller';
import { CatalogPartsService } from './catalog-parts.service';
import { CatalogPartsController } from './catalog-parts.controller';

@Module({
  controllers: [CatalogServicesController, CatalogPartsController],
  providers: [CatalogServicesService, CatalogPartsService],
})
export class CatalogModule {}
