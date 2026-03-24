import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { PublicQuotesService } from './public-quotes.service';

@Controller('public/quotes')
export class PublicQuotesController {
  constructor(private readonly publicQuotesService: PublicQuotesService) {}

  @Get(':token')
  getQuote(@Param('token') token: string) {
    return this.publicQuotesService.getQuote(token);
  }

  @Post(':token/approve')
  @HttpCode(204)
  approve(@Param('token') token: string) {
    return this.publicQuotesService.approve(token);
  }

  @Post(':token/reject')
  @HttpCode(204)
  reject(@Param('token') token: string) {
    return this.publicQuotesService.reject(token);
  }
}
