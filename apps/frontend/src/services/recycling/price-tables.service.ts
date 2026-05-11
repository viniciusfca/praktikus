import type { PriceTable } from '@praktikus/shared';
import { api } from '../api';

export type { PriceTable };

export const priceTablesService = {
  async list(): Promise<PriceTable[]> {
    const { data } = await api.get<PriceTable[]>('/recycling/price-tables');
    return data;
  },
};
