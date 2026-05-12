import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CButton, CCard, CCardBody, CSpinner } from '@coreui/react';
import { api } from '../../services/api';

export function MockCheckoutPage() {
  const [params] = useSearchParams();
  const tenantId = params.get('tenantId');
  const invoiceId = params.get('invoiceId');
  const type = params.get('type') ?? 'card';
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<'success' | 'fail' | null>(null);

  const simulateSuccess = async () => {
    setLoading(true);
    try {
      if (type === 'card' && tenantId) {
        await api.post('/billing/dev/simulate-card-checkout', { tenantId });
      } else if (type === 'invoice' && invoiceId) {
        await api.post(`/billing/dev/simulate-invoice-checkout/${invoiceId}`);
      }
      setDone('success');
      setTimeout(() => window.close(), 1500);
    } catch {
      setDone('fail');
    } finally {
      setLoading(false);
    }
  };

  const simulateFailure = () => {
    setDone('fail');
    setTimeout(() => window.close(), 1500);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: '#f7f8f8',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 420 }}>
        <CCardBody className="p-4">
          <div
            style={{
              fontSize: 11,
              color: '#5b6868',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 4,
            }}
          >
            Praktikus dev · checkout simulator
          </div>
          <h3 style={{ margin: '8px 0', fontSize: 18 }}>Asaas Mock Checkout</h3>
          <p style={{ fontSize: 14, color: '#5b6868', marginBottom: 16 }}>
            {type === 'card'
              ? 'Simule o cadastro de cartão de crédito recorrente.'
              : 'Simule o pagamento da fatura aberta.'}
          </p>
          <div
            style={{
              fontSize: 12,
              color: '#92400e',
              background: '#fef3c7',
              padding: 10,
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            Esta página só existe em ambiente de desenvolvimento (NODE_ENV !==
            production).
          </div>

          {done === 'success' && (
            <div
              style={{
                color: '#15803d',
                textAlign: 'center',
                padding: 12,
              }}
            >
              ✓ Sucesso. Fechando…
            </div>
          )}
          {done === 'fail' && (
            <div
              style={{
                color: '#b91c1c',
                textAlign: 'center',
                padding: 12,
              }}
            >
              Cancelado. Fechando…
            </div>
          )}
          {!done && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CButton
                color="primary"
                disabled={loading}
                onClick={simulateSuccess}
              >
                {loading ? <CSpinner size="sm" /> : 'Simular sucesso'}
              </CButton>
              <CButton
                color="secondary"
                variant="ghost"
                disabled={loading}
                onClick={simulateFailure}
              >
                Simular falha / cancelar
              </CButton>
            </div>
          )}
        </CCardBody>
      </CCard>
    </div>
  );
}
