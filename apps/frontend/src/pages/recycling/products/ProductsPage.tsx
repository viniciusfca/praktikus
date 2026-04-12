import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen } from '@coreui/icons';
import { productsService, type Product } from '../../../services/recycling/products.service';
import { unitsService, type Unit } from '../../../services/recycling/units.service';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, unitsData] = await Promise.all([
        productsService.list(true),
        unitsService.list(),
      ]);
      setProducts(productsData);
      setUnits(unitsData);
    } catch {
      setError('Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleActive = async (product: Product) => {
    try {
      await productsService.update(product.id, { active: !product.active });
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao atualizar produto.');
    }
  };

  const getUnitAbbreviation = (unitId: string): string => {
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.abbreviation : '—';
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Produtos</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/recycling/products/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Produto
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Unidade</CTableHeaderCell>
              <CTableHeaderCell>Preço/Unidade</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : products.map((p) => (
              <CTableRow key={p.id}>
                <CTableDataCell>{p.name}</CTableDataCell>
                <CTableDataCell>{getUnitAbbreviation(p.unitId)}</CTableDataCell>
                <CTableDataCell>{formatPrice(p.pricePerUnit)}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={p.active ? 'success' : 'secondary'}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/recycling/products/${p.id}/edit`)}
                    title="Editar"
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color={p.active ? 'warning' : 'success'}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(p)}
                    title={p.active ? 'Desativar' : 'Ativar'}
                  >
                    {p.active ? 'Desativar' : 'Ativar'}
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCard>
    </>
  );
}
