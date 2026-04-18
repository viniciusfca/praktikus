import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
import {
  cilCash,
  cilArrowBottom,
  cilArrowTop,
  cilClock,
  cilPlus,
  cilLockLocked,
  cilCheckCircle,
  cilWarning,
  cilInfo,
} from '@coreui/icons';
import {
  cashRegisterService,
  type CashSession,
  type CashTransaction,
} from '../../../services/recycling/cash-register.service';

// ── Schema ──────────────────────────────────────────────────────────────────
const transactionSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  paymentMethod: z.enum(['CASH', 'PIX', 'CARD']),
  amount: z.number().positive('O valor deve ser positivo.'),
  description: z.string().optional(),
});
type TransactionFormValues = z.infer<typeof transactionSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function paymentMethodLabel(method: 'CASH' | 'PIX' | 'CARD'): string {
  return { CASH: 'Dinheiro', PIX: 'PIX', CARD: 'Cartão' }[method];
}

// ── Local primitives ────────────────────────────────────────────────────────

type Tone = 'success' | 'info' | 'danger' | 'warning';

function SoftAlert({
  tone,
  title,
  description,
  onDismiss,
}: {
  tone: Tone;
  title: string;
  description?: string;
  onDismiss?: () => void;
}) {
  const tones: Record<Tone, { bg: string; border: string; fg: string; icon: typeof cilCheckCircle }> = {
    success: {
      bg: 'rgba(22, 163, 74, 0.08)',
      border: 'rgba(22, 163, 74, 0.25)',
      fg: '#15803d',
      icon: cilCheckCircle,
    },
    info: {
      bg: 'rgba(52, 142, 145, 0.08)',
      border: 'rgba(52, 142, 145, 0.25)',
      fg: 'var(--cui-primary)',
      icon: cilInfo,
    },
    danger: {
      bg: 'rgba(220, 38, 38, 0.08)',
      border: 'rgba(220, 38, 38, 0.25)',
      fg: '#b91c1c',
      icon: cilWarning,
    },
    warning: {
      bg: 'rgba(217, 119, 6, 0.08)',
      border: 'rgba(217, 119, 6, 0.25)',
      fg: '#b45309',
      icon: cilWarning,
    },
  };
  const t = tones[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
      }}
    >
      <CIcon icon={t.icon} style={{ color: t.fg, flexShrink: 0, marginTop: 2, width: 16, height: 16 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
        {description && (
          <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar alerta"
          style={{
            border: 0,
            background: 'transparent',
            color: t.fg,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CoreUI icon type
  icon,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CoreUI icon type
  icon: any;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--cui-card-cap-bg)',
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CIcon icon={icon} size="lg" />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--cui-secondary-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--cui-body-color)',
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  children,
  header,
  footer,
  padding = 20,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: number | string;
}) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
      {footer && (
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--cui-border-color)',
            background: 'var(--cui-card-cap-bg)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Transaction Modal ───────────────────────────────────────────────────────

interface TxModalProps {
  open: boolean;
  defaultType: 'IN' | 'OUT';
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  submitting: boolean;
}

function TransactionModal({ open, defaultType, onClose, onSubmit, submitting }: TxModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { type: defaultType, paymentMethod: 'CASH' },
  });

  useEffect(() => {
    if (open) {
      reset({ type: defaultType, paymentMethod: 'CASH' });
    }
  }, [open, defaultType, reset]);

  const type = watch('type');

  return (
    <CModal visible={open} onClose={onClose} size="sm">
      <CModalHeader>
        <CModalTitle>Nova transação</CModalTitle>
      </CModalHeader>
      <form
        onSubmit={handleSubmit(async (v) => {
          await onSubmit(v);
          reset();
        })}
        noValidate
      >
        <CModalBody>
          <p style={{ fontSize: 13, color: 'var(--cui-secondary-color)', margin: '0 0 14px' }}>
            Registre uma entrada ou saída no caixa.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Toggle Entrada/Saída */}
            <div>
              <CFormLabel style={labelStyle}>Tipo</CFormLabel>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 4,
                  padding: 3,
                  background: 'var(--cui-card-cap-bg)',
                  border: '1px solid var(--cui-border-color)',
                  borderRadius: 10,
                }}
              >
                {(
                  [
                    ['IN', 'Entrada', cilArrowBottom, '#16a34a'],
                    ['OUT', 'Saída', cilArrowTop, '#dc2626'],
                  ] as const
                ).map(([v, label, icon, color]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setValue('type', v, { shouldValidate: false })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      border: 0,
                      borderRadius: 7,
                      background: type === v ? 'var(--cui-card-bg)' : 'transparent',
                      color: type === v ? color : 'var(--cui-secondary-color)',
                      fontSize: 13,
                      fontWeight: type === v ? 600 : 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: type === v ? '0 1px 2px rgba(10,12,13,0.06)' : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    <CIcon icon={icon} size="sm" /> {label}
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('type')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <CFormLabel style={labelStyle}>Forma de pagamento</CFormLabel>
                <CFormSelect {...register('paymentMethod')}>
                  <option value="CASH">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="CARD">Cartão</option>
                </CFormSelect>
              </div>
              <div>
                <CFormLabel style={labelStyle}>Valor (R$)</CFormLabel>
                <CFormInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  {...register('amount', { valueAsNumber: true })}
                  invalid={!!errors.amount}
                />
                {errors.amount && <CFormFeedback invalid>{errors.amount.message}</CFormFeedback>}
              </div>
            </div>

            <div>
              <CFormLabel style={labelStyle}>Descrição (opcional)</CFormLabel>
              <CFormInput
                type="text"
                placeholder="Ex.: Venda de alumínio"
                {...register('description')}
              />
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={submitting}>
            {submitting ? <CSpinner size="sm" /> : 'Registrar'}
          </CButton>
        </CModalFooter>
      </form>
    </CModal>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function CashRegisterPage() {
  const [session, setSession] = useState<CashSession | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<'IN' | 'OUT'>('IN');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadCurrent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await cashRegisterService.getCurrent();
      setSession(current);
      if (current) {
        const txs = await cashRegisterService.getTransactions(current.id);
        setTransactions(txs);
      } else {
        setTransactions([]);
      }
    } catch {
      setError('Erro ao carregar estado do caixa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const handleOpen = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const opened = await cashRegisterService.open();
      setSession(opened);
      setTransactions([]);
      setSuccess('Caixa aberto com sucesso.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao abrir o caixa.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (
      !confirm(
        'Fechar o caixa agora? O saldo físico será calculado com base nas transações em dinheiro.',
      )
    )
      return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const closed = await cashRegisterService.close();
      setSession(closed);
      setSuccess(`Caixa fechado. Saldo final: ${formatCurrency(closed.closingBalance)}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao fechar o caixa.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTransaction = async (values: TransactionFormValues) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await cashRegisterService.addTransaction({
        type: values.type,
        paymentMethod: values.paymentMethod,
        amount: values.amount,
        description: values.description || undefined,
      });
      setTransactions((prev) => [...prev, tx]);
      setSuccess(
        `${values.type === 'IN' ? 'Entrada' : 'Saída'} de ${formatCurrency(values.amount)} registrada.`,
      );
      setTxModalOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao registrar transação.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Computed totals ──────────────────────────────────────────────────
  const totals = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    let inCount = 0;
    let outCount = 0;
    let cashInSum = 0;
    let cashOutSum = 0;
    for (const tx of transactions) {
      const amt = Number(tx.amount);
      if (tx.type === 'IN') {
        inSum += amt;
        inCount += 1;
        if (tx.paymentMethod === 'CASH') cashInSum += amt;
      } else {
        outSum += amt;
        outCount += 1;
        if (tx.paymentMethod === 'CASH') cashOutSum += amt;
      }
    }
    const physical = Number(session?.openingBalance ?? 0) + cashInSum - cashOutSum;
    return { inSum, outSum, inCount, outCount, physical };
  }, [transactions, session?.openingBalance]);

  const isOpen = session?.status === 'OPEN';
  const openedTime = session?.openedAt ? formatTime(session.openedAt) : '—';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <CSpinner color="primary" />
      </div>
    );
  }

  // ── Closed state ─────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              Caixa
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
              Abra o caixa para iniciar uma sessão de operações.
            </p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--cui-secondary-color)',
              background: 'var(--cui-card-cap-bg)',
              border: '1px solid var(--cui-border-color)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--cui-secondary-color)',
              }}
            />
            Caixa fechado
          </span>
        </div>

        {error && <SoftAlert tone="danger" title="Erro" description={error} onDismiss={() => setError(null)} />}
        {success && <SoftAlert tone="success" title={success} onDismiss={() => setSuccess(null)} />}

        <div
          style={{
            maxWidth: 560,
            background: 'var(--cui-card-bg)',
            border: '1px solid var(--cui-border-color)',
            borderRadius: 14,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(52, 142, 145, 0.12)',
              color: 'var(--cui-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CIcon icon={cilCash} size="xl" />
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--cui-body-color)',
                letterSpacing: '-0.01em',
              }}
            >
              {session?.status === 'CLOSED' ? 'Caixa está fechado' : 'Caixa não iniciado'}
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13,
                color: 'var(--cui-secondary-color)',
                maxWidth: 360,
              }}
            >
              O saldo de abertura é puxado automaticamente do fechamento da sessão anterior.
            </p>
          </div>

          {session?.status === 'CLOSED' && (
            <div
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--cui-card-cap-bg)',
                border: '1px solid var(--cui-border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--cui-secondary-color)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: 2,
                  }}
                >
                  Último fechamento
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--cui-body-color)',
                  }}
                >
                  {formatCurrency(session.closingBalance)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                {formatDateTime(session.closedAt)}
              </div>
            </div>
          )}

          <CButton
            color="primary"
            size="lg"
            onClick={handleOpen}
            disabled={actionLoading}
            style={{ borderRadius: 8, minWidth: 180 }}
          >
            {actionLoading ? <CSpinner size="sm" /> : 'Abrir caixa'}
          </CButton>
        </div>
      </div>
    );
  }

  // ── Open state ───────────────────────────────────────────────────────
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
            Caixa
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            Sessão aberta em {formatDateTime(session!.openedAt)}
          </p>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: '#16a34a',
            background: 'rgba(22, 163, 74, 0.12)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
          Caixa aberto
        </span>
      </div>

      {/* Alerts */}
      {error && <SoftAlert tone="danger" title="Erro" description={error} onDismiss={() => setError(null)} />}
      {success && <SoftAlert tone="success" title={success} onDismiss={() => setSuccess(null)} />}

      {/* 4 SummaryCards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <SummaryCard
          label="Saldo atual"
          value={formatCurrency(totals.physical)}
          accent="var(--cui-primary)"
          icon={cilCash}
          sub="Dinheiro em espécie"
        />
        <SummaryCard
          label="Entradas"
          value={formatCurrency(totals.inSum)}
          accent="#16a34a"
          icon={cilArrowBottom}
          sub={`${totals.inCount} ${totals.inCount === 1 ? 'transação' : 'transações'}`}
        />
        <SummaryCard
          label="Saídas"
          value={formatCurrency(totals.outSum)}
          accent="#dc2626"
          icon={cilArrowTop}
          sub={`${totals.outCount} ${totals.outCount === 1 ? 'transação' : 'transações'}`}
        />
        <SummaryCard
          label="Abertura"
          value={formatCurrency(session!.openingBalance)}
          accent="var(--cui-secondary-color)"
          icon={cilClock}
          sub={`às ${openedTime}`}
        />
      </div>

      {/* Transactions card */}
      <Card
        padding={0}
        header={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--cui-body-color)',
                }}
              >
                Transações da sessão
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
                {transactions.length}{' '}
                {transactions.length === 1 ? 'movimentação registrada' : 'movimentações registradas'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <CButton
                color="secondary"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTxModalType('OUT');
                  setTxModalOpen(true);
                }}
                style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={cilArrowTop} size="sm" /> Nova saída
              </CButton>
              <CButton
                color="primary"
                size="sm"
                onClick={() => {
                  setTxModalType('IN');
                  setTxModalOpen(true);
                }}
                style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={cilPlus} size="sm" /> Nova entrada
              </CButton>
            </div>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
              Ao fechar, o saldo físico será conferido.
            </span>
            <CButton
              color="danger"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={actionLoading}
              style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CIcon icon={cilLockLocked} size="sm" />
              {actionLoading ? <CSpinner size="sm" /> : 'Fechar caixa'}
            </CButton>
          </div>
        }
      >
        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Tipo</CTableHeaderCell>
              <CTableHeaderCell>Pagamento</CTableHeaderCell>
              <CTableHeaderCell>Descrição</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Valor</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Hora</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {transactions.length === 0 ? (
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
                      <CIcon icon={cilCash} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600 }}>Nenhuma transação ainda</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      Registre a primeira entrada ou saída no botão acima.
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : (
              transactions.map((tx) => {
                const isIn = tx.type === 'IN';
                return (
                  <CTableRow key={tx.id}>
                    <CTableDataCell>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: isIn ? '#15803d' : '#b91c1c',
                          background: isIn ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isIn ? '#16a34a' : '#dc2626',
                          }}
                        />
                        {isIn ? 'Entrada' : 'Saída'}
                      </span>
                    </CTableDataCell>
                    <CTableDataCell style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)' }}>
                      {paymentMethodLabel(tx.paymentMethod)}
                    </CTableDataCell>
                    <CTableDataCell style={{ fontWeight: 500 }}>
                      {tx.description ?? '—'}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: isIn ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {isIn ? '+ ' : '− '}
                      {formatCurrency(tx.amount)}
                    </CTableDataCell>
                    <CTableDataCell
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 12,
                        color: 'var(--cui-secondary-color)',
                      }}
                    >
                      {formatTime(tx.createdAt)}
                    </CTableDataCell>
                  </CTableRow>
                );
              })
            )}
          </CTableBody>
        </CTable>
      </Card>

      <TransactionModal
        open={txModalOpen}
        defaultType={txModalType}
        onClose={() => setTxModalOpen(false)}
        onSubmit={handleAddTransaction}
        submitting={actionLoading}
      />
    </div>
  );
}
