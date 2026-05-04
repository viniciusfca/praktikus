export interface PriceTable {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export type ProductPriceMap = Record<string, number | null>;

export interface RecyclingProduct {
  id: string;
  name: string;
  unitId: string;
  unit?: { id: string; name: string; abbreviation: string };
  pricePerUnit: number;
  prices: ProductPriceMap;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
