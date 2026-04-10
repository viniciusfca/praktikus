import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { RecyclingReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [RecyclingReportsService],
  exports: [RecyclingReportsService],
})
export class ReportsModule {}
