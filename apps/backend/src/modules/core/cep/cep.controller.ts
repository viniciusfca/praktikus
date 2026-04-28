import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CepService } from './cep.service';
import { CepLookupResponseDto } from './dto/cep-lookup-response.dto';

@Controller('cep')
@UseGuards(JwtAuthGuard)
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @Get(':cep')
  async lookup(@Param('cep') cep: string): Promise<CepLookupResponseDto> {
    return this.cepService.lookup(cep);
  }
}
