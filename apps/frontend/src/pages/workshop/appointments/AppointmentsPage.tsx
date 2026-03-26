import { useState, useEffect, useCallback } from 'react';
import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
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
import { cilPlus, cilChevronLeft, cilChevronRight, cilCalendar, cilList, cilPen, cilTrash } from '@coreui/icons';
import {
  appointmentsApi, type Appointment,
} from '../../../services/appointments.service';
import { AppointmentFormDialog } from './AppointmentFormDialog';
import { AppointmentDrawer } from './AppointmentDrawer';
import { useAuthStore } from '../../../store/auth.store';

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'secondary',
};

const CALENDAR_BG: Record<string, string> = {
  PENDENTE: '#f9b115',
  CONFIRMADO: '#39f',
  CONCLUIDO: '#1b9e3e',
  CANCELADO: '#aab3c5',
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - day + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function AppointmentsPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekRef, setWeekRef] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const weekDates = getWeekDates(weekRef);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await appointmentsApi.list({
        date_start: weekStart.toISOString(),
        date_end: new Date(weekEnd.getTime() + 86400000).toISOString(),
      });
      setAppointments(items);
    } catch {
      setError('Erro ao carregar agendamentos.');
    } finally {
      setLoading(false);
    }
  }, [weekStart.toISOString(), weekEnd.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (appt: Appointment) => { setEditing(appt); setFormOpen(true); setSelectedId(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirmar exclusão?')) return;
    try {
      await appointmentsApi.delete(id);
      load();
    } catch {
      setError('Erro ao deletar agendamento.');
    }
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="fw-bold mb-0">Agendamentos</h5>
        <CButton color="primary" size="sm" onClick={openNew}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Agendamento
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <CButton color="secondary" variant="ghost" size="sm" onClick={prevWeek}>
            <CIcon icon={cilChevronLeft} />
          </CButton>
          <span>{weekLabel}</span>
          <CButton color="secondary" variant="ghost" size="sm" onClick={nextWeek}>
            <CIcon icon={cilChevronRight} />
          </CButton>
        </div>
        <CButtonGroup size="sm">
          <CButton
            color="secondary"
            variant={view === 'calendar' ? undefined : 'outline'}
            onClick={() => setView('calendar')}
          >
            <CIcon icon={cilCalendar} />
          </CButton>
          <CButton
            color="secondary"
            variant={view === 'list' ? undefined : 'outline'}
            onClick={() => setView('list')}
          >
            <CIcon icon={cilList} />
          </CButton>
        </CButtonGroup>
      </div>

      {loading && <div className="text-center py-4"><CSpinner color="primary" /></div>}

      {!loading && view === 'calendar' && (
        <CCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--cui-border-color)' }}>
            {weekDates.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '8px',
                  textAlign: 'center',
                  borderRight: i < 6 ? '1px solid var(--cui-border-color)' : 'none',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--cui-secondary-color)' }}>{DAY_LABELS[d.getDay()]}</div>
                <div style={{ fontWeight: isSameDay(d, new Date()) ? 'bold' : 'normal', fontSize: '0.875rem' }}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
            {weekDates.map((d, i) => {
              const dayAppts = appointments
                .filter((a) => isSameDay(new Date(a.dataHora), d))
                .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
              return (
                <div
                  key={i}
                  style={{
                    padding: '4px',
                    borderRight: i < 6 ? '1px solid var(--cui-border-color)' : 'none',
                    minHeight: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {dayAppts.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      style={{
                        padding: '6px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        backgroundColor: CALENDAR_BG[a.status] ?? '#aab3c5',
                        color: '#fff',
                        opacity: 1,
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>
                        {new Date(a.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.tipoServico ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CCard>
      )}

      {!loading && view === 'list' && (
        <CCard>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Data/Hora</CTableHeaderCell>
                <CTableHeaderCell>Tipo de Serviço</CTableHeaderCell>
                <CTableHeaderCell>Duração</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {appointments.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={5} className="text-center text-secondary">
                    Nenhum agendamento nesta semana.
                  </CTableDataCell>
                </CTableRow>
              )}
              {appointments.map((a) => (
                <CTableRow
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <CTableDataCell>{new Date(a.dataHora).toLocaleString('pt-BR')}</CTableDataCell>
                  <CTableDataCell>{a.tipoServico ?? '—'}</CTableDataCell>
                  <CTableDataCell>{a.duracaoMin} min</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={STATUS_COLORS[a.status] ?? 'secondary'}>{a.status}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="text-end" onClick={(e) => e.stopPropagation()}>
                    <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <CIcon icon={cilPen} />
                    </CButton>
                    {isOwner && (
                      <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                        <CIcon icon={cilTrash} />
                      </CButton>
                    )}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCard>
      )}

      <AppointmentFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
      />

      <AppointmentDrawer
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(appt) => { setSelectedId(null); openEdit(appt); }}
        onDeleted={() => load()}
        isOwner={isOwner}
      />
    </>
  );
}
