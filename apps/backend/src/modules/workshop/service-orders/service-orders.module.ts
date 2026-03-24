import { Module } from '@nestjs/common';
import { ServiceOrdersController } from './service-orders.controller';
import { PublicQuotesController } from './public-quotes.controller';
import { ServiceOrdersService } from './service-orders.service';
import { PublicQuotesService } from './public-quotes.service';

@Module({
  controllers: [ServiceOrdersController, PublicQuotesController],
  providers: [ServiceOrdersService, PublicQuotesService],
})
export class ServiceOrdersModule {}
