import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import { publicQuotesApi, type QuoteData } from '../../services/service-orders.service';

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'already_used'; status: string }
  | { kind: 'success'; data: QuoteData }
  | { kind: 'approved' }
  | { kind: 'rejected' }
  | { kind: 'action_error'; message: string };

const STATUS_LABELS: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguardando Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function QuoteApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' });
      return;
    }
    publicQuotesApi
      .get(token)
      .then((data) => setState({ kind: 'success', data }))
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 404) {
            setState({ kind: 'invalid' });
          } else if (status === 410) {
            setState({ kind: 'expired' });
          } else if (status === 409) {
            const soStatus: string = err.response?.data?.status ?? '';
            setState({ kind: 'already_used', status: soStatus });
          } else {
            setState({ kind: 'invalid' });
          }
        } else {
          setState({ kind: 'invalid' });
        }
      });
  }, [token]);

  const handleApprove = async () => {
    if (submitting || !token) return;
    setSubmitting(true);
    try {
      await publicQuotesApi.approve(token);
      setState({ kind: 'approved' });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 410) setState({ kind: 'expired' });
        else if (status === 409) setState({ kind: 'already_used', status: err.response?.data?.status ?? 'APROVADO' });
        else setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      } else {
        setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (submitting || !token) return;
    setSubmitting(true);
    try {
      await publicQuotesApi.reject(token);
      setState({ kind: 'rejected' });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 410) setState({ kind: 'expired' });
        else if (status === 409) setState({ kind: 'already_used', status: err.response?.data?.status ?? 'APROVADO' });
        else setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      } else {
        setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        {state.kind === 'loading' && (
          <div className="d-flex justify-content-center mt-5">
            <CSpinner color="primary" />
          </div>
        )}

        {state.kind === 'invalid' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Link inválido</h5>
              <p className="text-secondary mb-0">Este link de aprovação não é válido. Verifique o link e tente novamente.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'expired' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Link expirado</h5>
              <p className="text-secondary mb-0">Link expirado. Entre em contato com a oficina.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'already_used' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Orçamento já respondido</h5>
              <p className="text-secondary mb-0">
                Orçamento já respondido. Status atual:{' '}
                {STATUS_LABELS[state.status] ?? state.status}
              </p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'action_error' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Erro</h5>
              <CAlert color="danger" className="mb-0">{state.message}</CAlert>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'approved' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <div style={{ fontSize: '3rem', color: 'var(--cui-success)', marginBottom: '0.5rem' }}>✓</div>
              <h5 className="fw-bold mb-2">Orçamento aprovado!</h5>
              <p className="text-secondary mb-0">Orçamento aprovado! Aguarde contato da oficina.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'rejected' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <div style={{ fontSize: '3rem', color: 'var(--cui-danger)', marginBottom: '0.5rem' }}>✗</div>
              <h5 className="fw-bold mb-2">Orçamento recusado</h5>
              <p className="text-secondary mb-0">Orçamento recusado.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'success' && (
          <>
            <div className="text-center mb-4">
              <h4 className="fw-bold">{state.data.empresa?.nome_fantasia ?? 'Oficina'}</h4>
              <p className="text-secondary mb-0">Aprovação de Orçamento</p>
            </div>

            <CCard className="mb-3">
              <CCardBody>
                <div className="fw-semibold mb-2">Dados do Cliente e Veículo</div>
                <hr className="my-2" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem' }}>
                  <small className="text-secondary">Cliente</small>
                  <small>{state.data.cliente?.nome ?? '—'}</small>
                  <small className="text-secondary">CPF / CNPJ</small>
                  <small>{state.data.cliente?.cpf_cnpj ?? '—'}</small>
                  <small className="text-secondary">Veículo</small>
                  <small>
                    {state.data.veiculo
                      ? `${state.data.veiculo.marca} ${state.data.veiculo.modelo} (${state.data.veiculo.ano})`
                      : '—'}
                  </small>
                  <small className="text-secondary">Placa</small>
                  <small>{state.data.veiculo?.placa ?? '—'}</small>
                </div>
              </CCardBody>
            </CCard>

            {state.data.itemsServices.length > 0 && (
              <CCard className="mb-3">
                <CCardBody>
                  <div className="fw-semibold mb-2">Serviços</div>
                  <hr className="my-2" />
                  <CTable small responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Nome</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Valor</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {state.data.itemsServices.map((item) => (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.nomeServico}</CTableDataCell>
                          <CTableDataCell className="text-end">{formatCurrency(item.valor)}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            )}

            {state.data.itemsParts.length > 0 && (
              <CCard className="mb-3">
                <CCardBody>
                  <div className="fw-semibold mb-2">Peças</div>
                  <hr className="my-2" />
                  <CTable small responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Nome</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Qtd</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Valor Unit.</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Subtotal</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {state.data.itemsParts.map((item) => (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.nomePeca}</CTableDataCell>
                          <CTableDataCell className="text-end">{item.quantidade}</CTableDataCell>
                          <CTableDataCell className="text-end">{formatCurrency(item.valorUnitario)}</CTableDataCell>
                          <CTableDataCell className="text-end">{formatCurrency(item.quantidade * item.valorUnitario)}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            )}

            <div className="d-flex justify-content-end mb-4">
              <h6 className="fw-bold mb-0">Total: {formatCurrency(state.data.total)}</h6>
            </div>

            <div className="d-flex gap-3 justify-content-center mb-4">
              <CButton
                color="success"
                size="lg"
                disabled={submitting}
                onClick={handleApprove}
              >
                {submitting ? <CSpinner size="sm" className="me-1" /> : null}
                Aprovar Orçamento
              </CButton>
              <CButton
                color="secondary"
                variant="outline"
                size="lg"
                disabled={submitting}
                onClick={handleReject}
              >
                Recusar
              </CButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
