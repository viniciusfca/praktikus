import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CBadge,
  CButton,
  CCard,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilExternalLink } from '@coreui/icons';
import { serviceOrdersApi, type ServiceOrder, type SoStatus } from '../../../services/service-orders.service';
import { CreateServiceOrderDialog } from './CreateServiceOrderDialog';

const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<SoStatus, string> = {
  ORCAMENTO: 'secondary',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

export function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const data = await serviceOrdersApi.list();
    setOrders(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Ordens de Serviço</h5>
        <CButton color="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <CIcon icon={cilPlus} className="me-1" />
          Nova OS
        </CButton>
      </div>

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell>Pagamento</CTableHeaderCell>
              <CTableHeaderCell>KM</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {orders.map((so) => (
              <CTableRow key={so.id}>
                <CTableDataCell>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={STATUS_COLOR[so.status]}>{STATUS_LABEL[so.status]}</CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge
                    color={so.statusPagamento === 'PAGO' ? 'success' : 'secondary'}
                    style={{ border: '1px solid currentColor', background: 'transparent' }}
                  >
                    {so.statusPagamento}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{so.kmEntrada ?? '—'}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/service-orders/${so.id}`)}
                  >
                    <CIcon icon={cilExternalLink} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
            {orders.length === 0 && (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center text-secondary">
                  Nenhuma OS encontrada.
                </CTableDataCell>
              </CTableRow>
            )}
          </CTableBody>
        </CTable>
      </CCard>

      <CreateServiceOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
    </>
  );
}
