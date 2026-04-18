import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CAlert,
  CButton,
  CFormInput,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilPlus,
  cilChevronLeft,
  cilChevronRight,
  cilCalendar,
  cilList,
  cilPen,
  cilTrash,
  cilSearch,
} from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import {
  appointmentsApi, type Appointment,
} from '../../../services/appointments.service';
import { AppointmentFormDialog } from './AppointmentFormDialog';
import { AppointmentDrawer } from './AppointmentDrawer';
import { useAuthStore } from '../../../store/auth.store';

// ── Status styling for calendar events ──────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  PENDENTE:   { bg: 'rgba(217, 119, 6, 0.12)',  border: '#d97706', text: '#b45309', label: 'Pendente' },
  CONFIRMADO: { bg: 'rgba(52, 142, 145, 0.12)', border: 'var(--cui-primary)', text: 'var(--cui-primary)', label: 'Confirmado' },
  CONCLUIDO:  { bg: 'rgba(22, 163, 74, 0.12)',  border: '#16a34a', text: '#15803d', label: 'Concluído' },
  CANCELADO:  { bg: 'rgba(107, 114, 128, 0.10)', border: '#9ca3af', text: '#6b7280', label: 'Cancelado' },
};

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h – 20h
const HOUR_HEIGHT = 56;

// ── Helpers ─────────────────────────────────────────────────────────────────
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

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.CANCELADO;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: s.text,
        background: s.bg,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.border }} />
      {s.label}
    </span>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export function AppointmentsPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekRef, setWeekRef] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const today = new Date();

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
  const goToday = () => setWeekRef(new Date());

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

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((a) =>
      (a.tipoServico ?? '').toLowerCase().includes(q)
      || (a.status ?? '').toLowerCase().includes(q),
    );
  }, [appointments, search]);

  return (
    <>
      <PageHead
        title="Agendamentos"
        subtitle={`Semana de ${weekLabel}`}
        actions={
          <>
            {/* Week nav */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CButton color="secondary" variant="outline" size="sm" onClick={prevWeek} style={{ borderRadius: 8, padding: '4px 10px' }} aria-label="Semana anterior">
                <CIcon icon={cilChevronLeft} size="sm" />
              </CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={goToday} style={{ borderRadius: 8 }}>
                Hoje
              </CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={nextWeek} style={{ borderRadius: 8, padding: '4px 10px' }} aria-label="Próxima semana">
                <CIcon icon={cilChevronRight} size="sm" />
              </CButton>
            </div>

            {/* View toggle */}
            <div
              style={{
                display: 'inline-flex',
                padding: 3,
                background: 'var(--cui-card-cap-bg)',
                border: '1px solid var(--cui-border-color)',
                borderRadius: 8,
                gap: 2,
              }}
            >
              {([
                ['calendar', cilCalendar, 'Calendário'],
                ['list', cilList, 'Lista'],
              ] as const).map(([v, icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  title={label}
                  aria-label={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 0,
                    background: view === v ? 'var(--cui-card-bg)' : 'transparent',
                    color: view === v ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                    fontSize: 12.5,
                    fontWeight: view === v ? 600 : 500,
                    boxShadow: view === v ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.12s',
                  }}
                >
                  <CIcon icon={icon} size="sm" />
                </button>
              ))}
            </div>

            <CButton color="primary" onClick={openNew} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilPlus} size="sm" /> Novo agendamento
            </CButton>
          </>
        }
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {loading && <div className="text-center py-4"><CSpinner color="primary" size="sm" /></div>}

      {/* ── Calendar view ──────────────────────────────────────────── */}
      {!loading && view === 'calendar' && (
        <div
          style={{
            background: 'var(--cui-card-bg)',
            border: '1px solid var(--cui-border-color)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {/* Day header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '70px repeat(7, 1fr)',
              borderBottom: '1px solid var(--cui-border-color)',
              background: 'var(--cui-card-cap-bg)',
            }}
          >
            <div />
            {weekDates.map((d, i) => {
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={i}
                  style={{
                    padding: '12px',
                    borderLeft: '1px solid var(--cui-border-color)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      color: isToday ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                    }}
                  >
                    {DAY_LABELS[i]}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      color: isToday ? 'var(--cui-primary)' : 'var(--cui-body-color)',
                      marginTop: 2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body with hours + event grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(7, 1fr)' }}>
            {/* Hour column */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {HOURS.map((h, idx) => (
                <div
                  key={h}
                  style={{
                    height: HOUR_HEIGHT,
                    padding: '6px 10px',
                    fontSize: 11,
                    color: 'var(--cui-secondary-color)',
                    borderTop: idx === 0 ? 0 : '1px solid var(--cui-border-color)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map((d, di) => {
              const dayAppts = appointments
                .filter((a) => isSameDay(new Date(a.dataHora), d))
                .map((a) => {
                  const date = new Date(a.dataHora);
                  const hour = date.getHours() + date.getMinutes() / 60;
                  const top = (hour - HOURS[0]) * HOUR_HEIGHT;
                  const height = Math.max(20, ((a.duracaoMin ?? 60) / 60) * HOUR_HEIGHT - 2);
                  return { appt: a, top, height, hour };
                })
                .filter((e) => e.hour >= HOURS[0] && e.hour < HOURS[HOURS.length - 1] + 1);

              return (
                <div
                  key={di}
                  style={{
                    position: 'relative',
                    borderLeft: '1px solid var(--cui-border-color)',
                  }}
                >
                  {HOURS.map((h, idx) => (
                    <div
                      key={h}
                      style={{
                        height: HOUR_HEIGHT,
                        borderTop: idx === 0 ? 0 : '1px solid var(--cui-border-color)',
                      }}
                    />
                  ))}

                  {dayAppts.map(({ appt, top, height }) => {
                    const s = STATUS_STYLES[appt.status] ?? STATUS_STYLES.CANCELADO;
                    const time = new Date(appt.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={appt.id}
                        onClick={() => setSelectedId(appt.id)}
                        style={{
                          position: 'absolute',
                          left: 4,
                          right: 4,
                          top,
                          height,
                          background: s.bg,
                          borderLeft: `3px solid ${s.border}`,
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: 11.5,
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          color: s.text,
                          transition: 'transform 0.1s, filter 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.96)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.filter = '';
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 12, color: s.text, fontVariantNumeric: 'tabular-nums' }}>
                          {time}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--cui-body-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                          {appt.tipoServico ?? 'Agendamento'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── List view ──────────────────────────────────────────────── */}
      {!loading && view === 'list' && (
        <div className="pk-table-card">
          <div className="pk-table-toolbar">
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <CIcon
                icon={cilSearch}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--cui-secondary-color)',
                  pointerEvents: 'none',
                  width: 14,
                  height: 14,
                }}
              />
              <CFormInput
                placeholder="Buscar por tipo de serviço ou status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
                size="sm"
              />
            </div>
          </div>

          <CTable hover responsive className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Data / Hora</CTableHeaderCell>
                <CTableHeaderCell>Tipo de serviço</CTableHeaderCell>
                <CTableHeaderCell style={{ textAlign: 'right' }}>Duração</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredList.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={5} className="text-center py-5">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,142,145,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CIcon icon={cilCalendar} size="lg" style={{ color: 'var(--cui-primary)' }} />
                      </div>
                      <div style={{ fontWeight: 600 }}>Nenhum agendamento</div>
                      <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                        {search ? 'Tente ajustar sua busca.' : 'Nenhum agendamento nesta semana.'}
                      </div>
                    </div>
                  </CTableDataCell>
                </CTableRow>
              ) : filteredList.map((a) => {
                const date = new Date(a.dataHora);
                return (
                  <CTableRow
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <CTableDataCell>
                      <div style={{ fontWeight: 600, color: 'var(--cui-body-color)', fontVariantNumeric: 'tabular-nums' }}>
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)', fontVariantNumeric: 'tabular-nums' }}>
                        {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </CTableDataCell>
                    <CTableDataCell style={{ fontWeight: 500 }}>{a.tipoServico ?? '—'}</CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cui-secondary-color)' }}>
                      {a.duracaoMin} min
                    </CTableDataCell>
                    <CTableDataCell>
                      <StatusPill status={a.status} />
                    </CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(a)} title="Editar">
                        <CIcon icon={cilPen} />
                      </CButton>
                      {isOwner && (
                        <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(a.id)} title="Excluir">
                          <CIcon icon={cilTrash} />
                        </CButton>
                      )}
                    </CTableDataCell>
                  </CTableRow>
                );
              })}
            </CTableBody>
          </CTable>
        </div>
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
