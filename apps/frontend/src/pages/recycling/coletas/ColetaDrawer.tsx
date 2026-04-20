import { useEffect, useState } from 'react';
import { COffcanvas, COffcanvasBody, COffcanvasHeader, COffcanvasTitle, CButton, CSpinner, CFormInput } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSend, cilPen, cilTrash, cilCheckCircle, cilXCircle } from '@coreui/icons';
import {
  coletasService,
  coletaCommentsService,
  ColetaStatus,
  type Coleta,
  type ColetaComment,
} from '../../../services/recycling/coletas.service';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';
import { employeesService, type Employee } from '../../../services/recycling/employees.service';

const STATUS_STYLES: Record<ColetaStatus, { bg: string; text: string; label: string; border: string }> = {
  [ColetaStatus.AGENDADA]: { bg: 'rgba(52,142,145,0.12)', text: 'var(--cui-primary)', border: 'var(--cui-primary)', label: 'Agendada' },
  [ColetaStatus.CONCLUIDA]: { bg: 'rgba(22,163,74,0.12)', text: '#15803d', border: '#16a34a', label: 'Concluída' },
  [ColetaStatus.CANCELADA]: { bg: 'rgba(107,114,128,0.10)', text: '#6b7280', border: '#9ca3af', label: 'Cancelada' },
};

function formatAddress(s: Supplier | null): string {
  if (!s || !s.address) return 'Endereço não cadastrado';
  const a = s.address;
  const parts = [`${a.street}, ${a.number}`, a.complement, a.city && `${a.city}/${a.state}`].filter(Boolean);
  return parts.join(' — ');
}

export function ColetaDrawer({
  coletaId,
  onClose,
  onEdit,
  onChanged,
}: {
  coletaId: string | null;
  onClose: () => void;
  onEdit: (c: Coleta) => void;
  onChanged: () => void;
}) {
  const [coleta, setColeta] = useState<Coleta | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [comments, setComments] = useState<ColetaComment[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!coletaId) { setColeta(null); return; }
    setLoading(true);
    coletasService.getById(coletaId).then(async (c) => {
      setColeta(c);
      const sup = await suppliersService.getById(c.supplierId).catch(() => null);
      setSupplier(sup);
      if (c.employeeId) {
        const emps = await employeesService.list().catch(() => []);
        setEmployee(emps.find((e) => e.id === c.employeeId) ?? null);
      } else {
        setEmployee(null);
      }
      const cs = await coletaCommentsService.list(c.id).catch(() => []);
      setComments(cs);
    }).finally(() => setLoading(false));
  }, [coletaId]);

  const changeStatus = async (next: ColetaStatus.CONCLUIDA | ColetaStatus.CANCELADA) => {
    if (!coleta) return;
    const verb = next === ColetaStatus.CONCLUIDA ? 'concluir' : 'cancelar';
    if (!window.confirm(`Confirmar ${verb} esta coleta?`)) return;
    await coletasService.updateStatus(coleta.id, next);
    onChanged();
    onClose();
  };

  const handleDelete = async () => {
    if (!coleta) return;
    if (!window.confirm('Confirmar exclusão da coleta?')) return;
    await coletasService.delete(coleta.id);
    onChanged();
    onClose();
  };

  const addComment = async () => {
    if (!coleta || !newText.trim()) return;
    setPosting(true);
    try {
      const created = await coletaCommentsService.create(coleta.id, newText.trim());
      setComments((prev) => [...prev, created]);
      setNewText('');
    } finally {
      setPosting(false);
    }
  };

  const status = coleta ? STATUS_STYLES[coleta.status] : null;
  const isAgendada = coleta?.status === ColetaStatus.AGENDADA;

  return (
    <COffcanvas placement="end" visible={!!coletaId} onHide={onClose}>
      <COffcanvasHeader>
        <COffcanvasTitle>Coleta</COffcanvasTitle>
        <CButton color="secondary" variant="ghost" size="sm" onClick={onClose}>×</CButton>
      </COffcanvasHeader>
      <COffcanvasBody>
        {loading && <div className="text-center py-3"><CSpinner size="sm" /></div>}
        {coleta && status && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 999,
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              color: status.text, background: status.bg, marginBottom: 16,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.border }} />
              {status.label}
            </div>

            <Field label="Fornecedor" value={supplier?.name ?? '—'} />
            <Field label="Endereço" value={formatAddress(supplier)} />
            <Field label="Telefone" value={supplier?.phone ?? '—'} />
            <Field label="Motorista" value={employee?.name ?? '—'} />
            <Field label="Data/Hora" value={new Date(coleta.scheduledAt).toLocaleString('pt-BR')} />
            {coleta.notes && <Field label="Observações" value={coleta.notes} />}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              {isAgendada && (
                <>
                  <CButton color="primary" variant="outline" size="sm" onClick={() => onEdit(coleta)}>
                    <CIcon icon={cilPen} size="sm" /> Editar
                  </CButton>
                  <CButton color="success" size="sm" onClick={() => changeStatus(ColetaStatus.CONCLUIDA)}>
                    <CIcon icon={cilCheckCircle} size="sm" /> Concluir
                  </CButton>
                  <CButton color="warning" variant="outline" size="sm" onClick={() => changeStatus(ColetaStatus.CANCELADA)}>
                    <CIcon icon={cilXCircle} size="sm" /> Cancelar
                  </CButton>
                  <CButton color="danger" variant="outline" size="sm" onClick={handleDelete}>
                    <CIcon icon={cilTrash} size="sm" /> Deletar
                  </CButton>
                </>
              )}
            </div>

            <hr style={{ margin: '20px 0' }} />

            <h6 style={{ fontSize: 13, fontWeight: 600 }}>Comentários</h6>
            {comments.length === 0 && (
              <p style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>Nenhum comentário.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--cui-border-color)' }}>
                <div style={{ fontSize: 13 }}>{c.texto}</div>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
                  {new Date(c.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <CFormInput
                placeholder="Adicionar comentário..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                disabled={posting}
              />
              <CButton color="primary" onClick={addComment} disabled={posting || !newText.trim()}>
                <CIcon icon={cilSend} size="sm" />
              </CButton>
            </div>
          </>
        )}
      </COffcanvasBody>
    </COffcanvas>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: 'var(--cui-body-color)' }}>{value}</div>
    </div>
  );
}
