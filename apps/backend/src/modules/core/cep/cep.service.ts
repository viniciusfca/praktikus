import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CepLookupResponseDto } from './dto/cep-lookup-response.dto';

interface CepliteRaw {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface ViaCepRaw {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

const REQUEST_TIMEOUT_MS = 3000;

@Injectable()
export class CepService {
  private readonly logger = new Logger(CepService.name);

  constructor(private readonly http: HttpService) {}

  async lookup(rawCep: string): Promise<CepLookupResponseDto> {
    const cep = (rawCep ?? '').replace(/\D/g, '');
    if (cep.length !== 8) {
      throw new BadRequestException('CEP inválido');
    }

    const cepliteOutcome = await this.tryCeplite(cep);
    if (cepliteOutcome.kind === 'ok') return cepliteOutcome.value;

    const viacepOutcome = await this.tryViaCep(cep);
    if (viacepOutcome.kind === 'ok') return viacepOutcome.value;

    if (
      cepliteOutcome.kind === 'not-found' &&
      viacepOutcome.kind === 'not-found'
    ) {
      throw new NotFoundException('CEP não encontrado');
    }

    this.logger.error(`[CepService] both ceplite and viacep failed for ${cep}`);
    throw new BadGatewayException('Falha ao consultar CEP');
  }

  private async tryCeplite(cep: string): Promise<Outcome> {
    try {
      const res = await firstValueFrom(
        this.http.get<CepliteRaw>(`https://ceplite.com.br/cep/${cep}`, {
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      const normalized = this.normalizeCeplite(res.data, cep);
      if (normalized) return { kind: 'ok', value: normalized };
      return { kind: 'fail' };
    } catch (err) {
      const axiosErr = err as AxiosError;
      this.logger.warn(
        `[CepService] ceplite failed for ${cep}, falling back to viacep. Reason: ${axiosErr.message}`,
      );
      if (axiosErr.response?.status === 404) return { kind: 'not-found' };
      return { kind: 'fail' };
    }
  }

  private async tryViaCep(cep: string): Promise<Outcome> {
    try {
      const res = await firstValueFrom(
        this.http.get<ViaCepRaw>(`https://viacep.com.br/ws/${cep}/json/`, {
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
      if (res.data?.erro === true) return { kind: 'not-found' };
      const normalized = this.normalizeViaCep(res.data, cep);
      if (normalized) return { kind: 'ok', value: normalized };
      return { kind: 'fail' };
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) return { kind: 'not-found' };
      return { kind: 'fail' };
    }
  }

  private normalizeCeplite(
    raw: CepliteRaw | null | undefined,
    cep: string,
  ): CepLookupResponseDto | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.cidade === undefined || raw.uf === undefined) return null;
    return {
      cep,
      street: raw.logradouro ?? '',
      neighborhood: raw.bairro ?? '',
      city: raw.cidade ?? '',
      state: raw.uf ?? '',
    };
  }

  private normalizeViaCep(
    raw: ViaCepRaw | null | undefined,
    cep: string,
  ): CepLookupResponseDto | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.localidade === undefined || raw.uf === undefined) return null;
    return {
      cep,
      street: raw.logradouro ?? '',
      neighborhood: raw.bairro ?? '',
      city: raw.localidade ?? '',
      state: raw.uf ?? '',
    };
  }
}

type Outcome =
  | { kind: 'ok'; value: CepLookupResponseDto }
  | { kind: 'not-found' }
  | { kind: 'fail' };
