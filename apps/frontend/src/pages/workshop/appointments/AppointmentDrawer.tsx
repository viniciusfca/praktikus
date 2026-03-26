import { useCallback, useEffect, useState } from 'react';
import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  COffcanvas,
  COffcanvasBody,
  COffcanvasHeader,
  COffcanvasTitle,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSend, cilX } from '@coreui/icons';
import {
  appointmentsApi, appointmentCommentsApi,
  type Appointment, type AppointmentComment,
} from '../../../services/appointments.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'secondary',
};

interface Props {
  appointmentId: string | null;
  onClose: () => void;
  onEdit: (appt: Appointment) => void;
  onDeleted: () => void;
  isOwner: boolean;
}

export function AppointmentDrawer({ appointmentId, onClose, onEdit, onDeleted, isOwner }: Props) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [comments, setComments] = useState<AppointmentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [a, c] = await Promise.all([
        appointmentsApi.getById(id),
        appointmentCommentsApi.list(id),
      ]);
      setAppt(a);
      setComments(c);
      const [cust, veh] = await Promise.all([
        customersService.getById(a.clienteId),
        vehiclesService.getById(a.veiculoId),
      ]);
      setCustomer(cust);
      setVehicle(veh);
    } catch {
      setAppt(null);
      setError('Erro ao carregar agendamento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appointmentId) loadData(appointmentId);
    else { setAppt(null); setCustomer(null); setVehicle(null); setComments([]); setError(null); }
  }, [appointmentId, loadData]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !appointmentId) return;
    try {
      const c = await appointmentCommentsApi.create(appointmentId, newComment.trim());
      setComments((prev) => [...prev, c]);
      setNewComment('');
    } catch {
      setError('Erro ao adicionar comentário.');
    }
  };

  const handleDelete = async () => {
    if (!appt) return;
    if (!window.confirm('Confirmar exclusão do agendamento?')) return;
    try {
      await appointmentsApi.delete(appt.id);
      onDeleted();
      onClose();
    } catch {
      setError('Erro ao deletar agendamento.');
    }
  };

  return (
    <COffcanvas placement="end" visible={!!appointmentId} onHide={onClose} style={{ width: 380 }}>
      <COffcanvasHeader>
        <COffcanvasTitle>Agendamento</COffcanvasTitle>
        <CButton color="secondary" variant="ghost" size="sm" onClick={onClose}>
          <CIcon icon={cilX} />
        </CButton>
      </COffcanvasHeader>
      <COffcanvasBody className="d-flex flex-column">
        {loading && <CSpinner color="primary" className="align-self-center mt-4" />}
        {error && <CAlert color="danger">{error}</CAlert>}

        {appt && !loading && (
          <>
            <CBadge
              color={STATUS_COLORS[appt.status] ?? 'secondary'}
              className="align-self-start mb-3"
            >
              {appt.status}
            </CBadge>

            <small className="text-secondary">Cliente</small>
            <div className="mb-2">{customer?.nome ?? appt.clienteId}</div>

            <small className="text-secondary">Veículo</small>
            <div className="mb-2">
              {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : appt.veiculoId}
            </div>

            <small className="text-secondary">Data/Hora</small>
            <div className="mb-2">
              {new Date(appt.dataHora).toLocaleString('pt-BR')} ({appt.duracaoMin} min)
            </div>

            {appt.tipoServico && (
              <>
                <small className="text-secondary">Tipo de Serviço</small>
                <div className="mb-2">{appt.tipoServico}</div>
              </>
            )}

            <div className="d-flex gap-2 mt-2 mb-3">
              <CButton color="secondary" variant="outline" size="sm" onClick={() => onEdit(appt)}>Editar</CButton>
              {isOwner && (
                <CButton color="danger" variant="outline" size="sm" onClick={handleDelete}>Deletar</CButton>
              )}
            </div>

            <hr className="mb-3" />
            <div className="fw-semibold mb-2">Comentários</div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {comments.length === 0 && (
                <small className="text-secondary">Nenhum comentário.</small>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="mb-2 p-2 rounded"
                  style={{ backgroundColor: 'var(--cui-tertiary-bg)' }}
                >
                  <div style={{ fontSize: '0.875rem' }}>{c.texto}</div>
                  <small className="text-secondary">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </small>
                </div>
              ))}
            </div>

            <div className="d-flex gap-2">
              <CFormInput
                size="sm"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <CButton
                color="primary"
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                <CIcon icon={cilSend} />
              </CButton>
            </div>
          </>
        )}
      </COffcanvasBody>
    </COffcanvas>
  );
}
