import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilTrash, cilSearch, cilFactory } from '@coreui/icons';
import { useBuyers } from '../../../hooks/recycling/useBuyers';
import { buyersService, type Buyer } from '../../../services/recycling/buyers.service';

// ── Schema ──────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos').optional().or(z.literal('')),
  phone: z.string().optional(),
  contactName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Helpers ─────────────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

function formatCnpj(cnpj: string | null): string {
  if (!cnpj) return '—';
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function BuyerAvatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'rgba(52,142,145,0.12)',
        color: 'var(--cui-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11.5,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Form Dialog ─────────────────────────────────────────────────────────────

interface BuyerFormDialogProps {
  open: boolean;
  editing: Buyer | null;
  onClose: () => void;
  onSaved: () => void;
}

function BuyerFormDialog({ open, editing, onClose, onSaved }: BuyerFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    // Reset stale submit error and form values when modal opens for a (new) editing target.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clear stale UI state on dialog open
    setSubmitError(null);
    if (editing) {
      reset({
        name: editing.name,
        cnpj: editing.cnpj ?? '',
        phone: editing.phone ?? '',
        contactName: editing.contactName ?? '',
      });
    } else {
      reset({ name: '', cnpj: '', phone: '', contactName: '' });
    }
  }, [open, editing, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const payload = {
      name: data.name,
      cnpj: data.cnpj || null,
      phone: data.phone || null,
      contactName: data.contactName || null,
    };

    try {
      if (editing) {
        await buyersService.update(editing.id, payload);
      } else {
        await buyersService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao salvar comprador.'));
    }
  };

  return (
    <CModal visible={open} onClose={onClose}>
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar comprador' : 'Novo comprador'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CModalBody>
          {submitError && (
            <CAlert color="danger" className="mb-3">
              {submitError}
            </CAlert>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <CFormLabel style={labelStyle}>Nome *</CFormLabel>
              <CFormInput {...register('name')} invalid={!!errors.name} />
              {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
            </div>

            <div>
              <CFormLabel style={labelStyle}>CNPJ (14 dígitos, opcional)</CFormLabel>
              <CFormInput
                {...register('cnpj')}
                placeholder="00000000000000"
                invalid={!!errors.cnpj}
              />
              {errors.cnpj && <CFormFeedback invalid>{errors.cnpj.message}</CFormFeedback>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <CFormLabel style={labelStyle}>Telefone</CFormLabel>
                <CFormInput {...register('phone')} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <CFormLabel style={labelStyle}>Pessoa de contato</CFormLabel>
                <CFormInput {...register('contactName')} placeholder="Ex.: João Silva" />
              </div>
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={isSubmitting}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
          </CButton>
        </CModalFooter>
      </form>
    </CModal>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function BuyersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Buyer | null>(null);
  const limit = 20;

  const { buyers, total, loading, error, reload } = useBuyers(page, limit, search || undefined);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (buyer: Buyer) => {
    if (!confirm(`Excluir comprador "${buyer.name}"?`)) return;
    try {
      await buyersService.delete(buyer.id);
      reload();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message ?? 'Erro ao excluir comprador.');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (buyer: Buyer) => {
    setEditing(buyer);
    setModalOpen(true);
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const shownFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const shownTo = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            Compradores
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            {total > 0
              ? `${total} ${total === 1 ? 'comprador cadastrado' : 'compradores cadastrados'}`
              : 'Cadastre empresas que compram material'}
          </p>
        </div>
        <CButton
          color="primary"
          onClick={openCreate}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Novo comprador
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Table card */}
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
              placeholder="Buscar por nome..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onBlur={handleSearch}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar compradores"
            />
          </div>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Empresa</CTableHeaderCell>
              <CTableHeaderCell>CNPJ</CTableHeaderCell>
              <CTableHeaderCell>Telefone</CTableHeaderCell>
              <CTableHeaderCell>Contato</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : buyers.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center py-5">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(52,142,145,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CIcon icon={cilFactory} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--cui-body-color)' }}>
                      {search ? 'Nenhum resultado' : 'Nenhum comprador ainda'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search
                        ? 'Tente ajustar sua busca.'
                        : 'Cadastre o primeiro comprador para começar.'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              buyers.map((b) => (
                <CTableRow key={b.id}>
                  <CTableDataCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <BuyerAvatar name={b.name} />
                      <span style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{b.name}</span>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: 'var(--cui-secondary-color)',
                    }}
                  >
                    {formatCnpj(b.cnpj)}
                  </CTableDataCell>
                  <CTableDataCell style={{ color: 'var(--cui-body-color)', fontSize: 13 }}>
                    {b.phone ?? '—'}
                  </CTableDataCell>
                  <CTableDataCell style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                    {b.contactName ?? '—'}
                  </CTableDataCell>
                  <CTableDataCell style={{ textAlign: 'right' }}>
                    <CButton
                      color="secondary"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(b)}
                      title="Editar"
                    >
                      <CIcon icon={cilPen} />
                    </CButton>
                    <CButton
                      color="danger"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(b)}
                      title="Excluir"
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))
            )}
          </CTableBody>
        </CTable>

        <div className="pk-table-footer">
          <span>
            {total > 0 ? `Mostrando ${shownFrom}–${shownTo} de ${total}` : 'Nenhum registro'}
          </span>
          {total > limit && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                aria-label="Página anterior"
              >
                ‹
              </CButton>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  fontWeight: 500,
                  color: 'var(--cui-body-color)',
                }}
              >
                {page} / {totalPages}
              </span>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                aria-label="Próxima página"
              >
                ›
              </CButton>
            </div>
          )}
        </div>
      </div>

      <BuyerFormDialog
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />
    </div>
  );
}
