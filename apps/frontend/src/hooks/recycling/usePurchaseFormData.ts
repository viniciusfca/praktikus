import { useState, useEffect } from 'react';
import { suppliersService, type Supplier } from '../../services/recycling/suppliers.service';
import { productsService, type Product } from '../../services/recycling/products.service';

export function usePurchaseFormData() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      suppliersService.list(1, 100),
      productsService.list(),
    ])
      .then(([suppliersRes, productsRes]) => {
        setSuppliers(suppliersRes.data);
        setProducts(productsRes);
      })
      .catch(() => setError('Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  return { suppliers, products, loading, error };
}
