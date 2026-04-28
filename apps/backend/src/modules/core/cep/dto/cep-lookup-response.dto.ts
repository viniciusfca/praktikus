import { CepLookupResponse } from '@praktikus/shared';

export class CepLookupResponseDto implements CepLookupResponse {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}
