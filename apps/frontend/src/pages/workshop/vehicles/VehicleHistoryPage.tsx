import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft } from '@coreui/icons';
import {
  vehiclesService,
  type Vehicle,
  type VehicleServiceOrder,
} from '../../../services/vehicles.service';

const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<string, string> = {
  ORCAMENTO: 'secondary',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function VehicleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [orders, setOrders] = useState<VehicleServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [v, os] = await Promise.all([
        vehiclesService.getById(id),
        vehiclesService.getServiceOrders(id),
      ]);
      setVehicle(v);
      setOrders(os);
    } catch {
      setError('Erro ao carregar histórico do veículo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-4">
        <CSpinner color="primary" />
      </div>
    );
  }

  return (
    <>
      <CButton
        color="secondary"
        variant="ghost"
        size="sm"
        className="mb-3"
        onClick={() => navigate('/workshop/vehicles')}
      >
        <CIcon icon={cilArrowLeft} className="me-1" />
        Veículos
      </CButton>

      <div className="mb-4">
        <h5 className="fw-bold mb-0">
          {vehicle
            ? `${vehicle.placa} — ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`
            : 'Veículo'}
        </h5>
        <small className="text-secondary">Prontuário do Veículo</small>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {orders.length === 0 && !error && (
        <p className="text-secondary">
          Nenhuma ordem de serviço registrada para este veículo.
        </p>
      )}

      <div className="d-flex flex-column gap-3">
        {orders.map((o) => {
          const services = o.itemsServices.map((s) => s.nomeServico).join(', ');
          const parts = o.itemsParts
            .map((p) => `${p.nomePeca} x${p.quantidade}`)
            .join(', ');

          return (
            <CCard key={o.id}>
              <CCardBody>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-secondary">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </small>
                  <CBadge color={STATUS_COLOR[o.status] ?? 'secondary'}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </CBadge>
                </div>

                {o.kmEntrada && (
                  <p className="text-secondary small mb-1">KM entrada: {o.kmEntrada}</p>
                )}
                {services && (
                  <p className="small mb-1"><strong>Serviços:</strong> {services}</p>
                )}
                {parts && (
                  <p className="small mb-0"><strong>Peças:</strong> {parts}</p>
                )}

                <hr className="my-2" />

                <div className="d-flex justify-content-between align-items-center">
                  <strong>{fmt(o.total)}</strong>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/service-orders/${o.id}`)}
                  >
                    Ver OS →
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          );
        })}
      </div>
    </>
  );
}
