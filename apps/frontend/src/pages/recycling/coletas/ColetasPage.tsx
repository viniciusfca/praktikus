import { useCallback, useMemo, useState } from 'react';
import {
  CAlert, CButton, CFormInput, CSpinner,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilChevronLeft, cilChevronRight, cilCalendar, cilList, cilPen, cilTrash, cilSearch } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import {
  coletasService, ColetaStatus, type Coleta,
} from '../../../services/recycling/coletas.service';
import { useColetasByWeek } from '../../../hooks/recycling/useColetas';
import { ColetaFormDialog } from './ColetaFormDialog';
import { ColetaDrawer } from './ColetaDrawer';

const STATUS_STYLES: Record<ColetaStatus, { bg: string; border: string; text: string; label: string }> = {
  [ColetaStatus.AGENDADA]:  { bg: 'rgba(52,142,145,0.12)', border: 'var(--cui-primary)', text: 'var(--cui-primary)', label: 'Agendada' },
  [ColetaStatus.CONCLUIDA]: { bg: 'rgba(22,163,74,0.12)',  border: '#16a34a', text: '#15803d', label: 'Concluída' },
  [ColetaStatus.CANCELADA]: { bg: 'rgba(107,114,128,0.10)', border: '#9ca3af', text: '#6b7280', label: 'Cancelada' },
};

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const HOUR_HEIGHT = 56;
const CARD_HEIGHT = 28;

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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function StatusPill({ status }: { status: ColetaStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      color: s.text, background: s.bg, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.border }} />
      {s.label}
    </span>
  );
}

export function ColetasPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekRef, setWeekRef] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Coleta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const { coletas, loading, refetch } = useColetasByWeek(weekStart, weekEnd);

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
  const goToday = () => setWeekRef(new Date());

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = useCallback((c: Coleta) => { setEditing(c); setFormOpen(true); setSelectedId(null); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirmar exclusão?')) return;
    try { await coletasService.delete(id); refetch(); }
    catch { setError('Erro ao deletar coleta.'); }
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coletas;
    return coletas.filter((c) =>
      (c.notes ?? '').toLowerCase().includes(q) || (c.status ?? '').toLowerCase().includes(q),
    );
  }, [coletas, search]);

  return (
    <>
      <PageHead
        title="Coletas"
        subtitle={`Semana de ${weekLabel}`}
        actions={
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CButton color="secondary" variant="outline" size="sm" onClick={prevWeek} style={{ borderRadius: 8, padding: '4px 10px' }} aria-label="Semana anterior">
                <CIcon icon={cilChevronLeft} size="sm" />
              </CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={goToday} style={{ borderRadius: 8 }}>Hoje</CButton>
              <CButton color="secondary" variant="outline" size="sm" onClick={nextWeek} style={{ borderRadius: 8, padding: '4px 10px' }} aria-label="Próxima semana">
                <CIcon icon={cilChevronRight} size="sm" />
              </CButton>
            </div>

            <div style={{
              display: 'inline-flex', padding: 3, gap: 2,
              background: 'var(--cui-card-cap-bg)', border: '1px solid var(--cui-border-color)', borderRadius: 8,
            }}>
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
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '5px 10px', borderRadius: 6, border: 0,
                    background: view === v ? 'var(--cui-card-bg)' : 'transparent',
                    color: view === v ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                    fontSize: 12.5, fontWeight: view === v ? 600 : 500,
                    boxShadow: view === v ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  }}
                >
                  <CIcon icon={icon} size="sm" />
                </button>
              ))}
            </div>

            <CButton color="primary" onClick={openNew} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilPlus} size="sm" /> Nova coleta
            </CButton>
          </>
        }
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}
      {loading && <div className="text-center py-4"><CSpinner color="primary" size="sm" /></div>}

      {!loading && view === 'calendar' && (
        <div style={{
          border: '1px solid var(--cui-border-color)', borderRadius: 12,
          overflow: 'hidden', background: 'var(--cui-card-bg)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)`, borderBottom: '1px solid var(--cui-border-color)' }}>
            <div />
            {weekDates.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 8, borderLeft: '1px solid var(--cui-border-color)' }}>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', fontWeight: 600 }}>{DAY_LABELS[i]}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)`, position: 'relative' }}>
            <div>
              {HOURS.map((h) => (
                <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--cui-border-color)', padding: 4, fontSize: 11, color: 'var(--cui-secondary-color)' }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {weekDates.map((d, i) => (
              <div key={i} style={{ position: 'relative', borderLeft: '1px solid var(--cui-border-color)' }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--cui-border-color)' }} />
                ))}
                {coletas
                  .filter((c) => isSameDay(new Date(c.scheduledAt), d))
                  .map((c) => {
                    const date = new Date(c.scheduledAt);
                    const minutesFrom7 = (date.getHours() - 7) * 60 + date.getMinutes();
                    const top = (minutesFrom7 / 60) * HOUR_HEIGHT;
                    const s = STATUS_STYLES[c.status];
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        style={{
                          position: 'absolute', top, left: 4, right: 4, height: CARD_HEIGHT,
                          padding: '3px 6px', borderRadius: 6, border: 0,
                          borderLeft: `3px solid ${s.border}`, background: s.bg, color: s.text,
                          textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
                          fontSize: 11, fontFamily: 'inherit',
                        }}
                      >
                        <strong>{date.toTimeString().slice(0, 5)}</strong>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && view === 'list' && (
        <div>
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <CIcon icon={cilSearch} size="sm" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--cui-secondary-color)' }} />
            <CFormInput
              placeholder="Buscar por observações ou status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <CTable hover>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Data / Hora</CTableHeaderCell>
                <CTableHeaderCell>Observações</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filteredList.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={4} style={{ textAlign: 'center', color: 'var(--cui-secondary-color)' }}>
                    Nenhuma coleta nessa semana.
                  </CTableDataCell>
                </CTableRow>
              )}
              {filteredList.map((c) => {
                const d = new Date(c.scheduledAt);
                return (
                  <CTableRow key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(c.id)}>
                    <CTableDataCell>
                      <div style={{ fontWeight: 600 }}>{d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                      <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>{d.toTimeString().slice(0, 5)}</div>
                    </CTableDataCell>
                    <CTableDataCell>{c.notes ?? '—'}</CTableDataCell>
                    <CTableDataCell><StatusPill status={c.status} /></CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <CButton size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <CIcon icon={cilPen} size="sm" />
                      </CButton>
                      <CButton size="sm" color="danger" variant="ghost" onClick={() => handleDelete(c.id)}>
                        <CIcon icon={cilTrash} size="sm" />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                );
              })}
            </CTableBody>
          </CTable>
        </div>
      )}

      <ColetaFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
        editing={editing}
      />

      <ColetaDrawer
        coletaId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={openEdit}
        onChanged={refetch}
      />
    </>
  );
}
