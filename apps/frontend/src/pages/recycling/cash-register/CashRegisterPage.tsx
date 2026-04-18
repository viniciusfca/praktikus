import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import {
  cashRegisterService,
  type CashSession,
  type CashTransaction,
} from '../../../services/recycling/cash-register.service';

const transactionSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  paymentMethod: z.enum(['CASH', 'PIX', 'CARD']),
  amount: z.number().positive('O valor deve ser positivo.'),
  description: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function paymentMethodLabel(method: 'CASH' | 'PIX' | 'CARD'): string {
  const labels = { CASH: 'Dinheiro', PIX: 'PIX', CARD: 'Cartão' };
  return labels[method];
}

export function CashRegisterPage() {
  const [session, setSession] = useState<CashSession | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { type: 'IN', paymentMethod: 'CASH' },
  });

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
    if (!confirm('Fechar o caixa agora? O saldo físico será calculado com base nas transações em dinheiro.')) return;
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
      setSuccess('Transação registrada com sucesso.');
      setShowForm(false);
      reset();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao registrar transação.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <CSpinner />
      </div>
    );
  }

  const isOpen = session?.status === 'OPEN';

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Caixa</h5>
        <CBadge color={isOpen ? 'success' : 'secondary'} className="fs-6 px-3 py-2">
          {isOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
        </CBadge>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)} className="mb-3">
          {error}
        </CAlert>
      )}
      {success && (
        <CAlert color="success" dismissible onClose={() => setSuccess(null)} className="mb-3">
          {success}
        </CAlert>
      )}

      <CRow className="mb-4">
        <CCol md={6}>
          <CCard>
            <CCardBody>
              {isOpen && session ? (
                <>
                  <div className="mb-2">
                    <small className="text-muted">Operador (ID)</small>
                    <div className="fw-semibold">{session.operatorId}</div>
                  </div>
                  <div className="mb-2">
                    <small className="text-muted">Abertura</small>
                    <div>{formatDateTime(session.openedAt)}</div>
                  </div>
                  <div className="mb-3">
                    <small className="text-muted">Saldo de abertura</small>
                    <div className="fw-semibold">{formatCurrency(session.openingBalance)}</div>
                  </div>
                  <CAlert color="info" className="mb-3 py-2">
                    O saldo físico é calculado no fechamento do caixa.
                  </CAlert>
                  <div className="d-flex gap-2">
                    <CButton
                      color="success"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowForm(true); reset({ type: 'IN', paymentMethod: 'CASH' }); }}
                      disabled={actionLoading}
                    >
                      Nova Entrada
                    </CButton>
                    <CButton
                      color="warning"
                      variant="outline"
                      size="sm"
                      onClick={() => { setShowForm(true); reset({ type: 'OUT', paymentMethod: 'CASH' }); }}
                      disabled={actionLoading}
                    >
                      Nova Saída
                    </CButton>
                    <CButton
                      color="danger"
                      size="sm"
                      onClick={handleClose}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <CSpinner size="sm" /> : 'Fechar Caixa'}
                    </CButton>
                  </div>
                </>
              ) : (
                <>
                  {session?.status === 'CLOSED' && (
                    <div className="mb-3">
                      <small className="text-muted">Último saldo de fechamento</small>
                      <div className="fw-semibold fs-5">{formatCurrency(session.closingBalance)}</div>
                      <small className="text-muted">Fechado em: {formatDateTime(session.closedAt)}</small>
                    </div>
                  )}
                  <CButton
                    color="primary"
                    onClick={handleOpen}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <CSpinner size="sm" /> : 'Abrir Caixa'}
                  </CButton>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {showForm && isOpen && (
        <CCard className="mb-4">
          <CCardHeader>Nova Transação</CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit(handleAddTransaction)}>
              <CRow className="g-3">
                <CCol md={3}>
                  <CFormLabel>Tipo</CFormLabel>
                  <CFormSelect {...register('type')}>
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                  </CFormSelect>
                </CCol>
                <CCol md={3}>
                  <CFormLabel>Forma de pagamento</CFormLabel>
                  <CFormSelect {...register('paymentMethod')}>
                    <option value="CASH">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="CARD">Cartão</option>
                  </CFormSelect>
                </CCol>
                <CCol md={3}>
                  <CFormLabel>Valor (R$)</CFormLabel>
                  <CFormInput
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...register('amount', { valueAsNumber: true })}
                    invalid={!!errors.amount}
                  />
                  {errors.amount && (
                    <div className="invalid-feedback d-block">{errors.amount.message}</div>
                  )}
                </CCol>
                <CCol md={3}>
                  <CFormLabel>Descrição (opcional)</CFormLabel>
                  <CFormInput type="text" {...register('description')} />
                </CCol>
              </CRow>
              <div className="d-flex gap-2 mt-3">
                <CButton type="submit" color="primary" size="sm" disabled={actionLoading}>
                  {actionLoading ? <CSpinner size="sm" /> : 'Registrar'}
                </CButton>
                <CButton
                  type="button"
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowForm(false); reset(); }}
                  disabled={actionLoading}
                >
                  Cancelar
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      )}

      {isOpen && (
        <CCard>
          <CCardHeader>Transações da sessão atual</CCardHeader>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Tipo</CTableHeaderCell>
                <CTableHeaderCell>Pagamento</CTableHeaderCell>
                <CTableHeaderCell>Valor</CTableHeaderCell>
                <CTableHeaderCell>Descrição</CTableHeaderCell>
                <CTableHeaderCell>Hora</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {transactions.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={5} className="text-center py-3 text-muted">
                    Nenhuma transação registrada nesta sessão.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                transactions.map((tx) => (
                  <CTableRow key={tx.id}>
                    <CTableDataCell>
                      <CBadge color={tx.type === 'IN' ? 'success' : 'danger'}>
                        {tx.type === 'IN' ? 'Entrada' : 'Saída'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{paymentMethodLabel(tx.paymentMethod)}</CTableDataCell>
                    <CTableDataCell className={tx.type === 'IN' ? 'text-success' : 'text-danger'}>
                      {tx.type === 'OUT' ? '- ' : ''}{formatCurrency(tx.amount)}
                    </CTableDataCell>
                    <CTableDataCell>{tx.description ?? '—'}</CTableDataCell>
                    <CTableDataCell>{formatDateTime(tx.createdAt)}</CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </CCard>
      )}
    </>
  );
}
