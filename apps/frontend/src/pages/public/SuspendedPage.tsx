import { CButton, CCard, CCardBody } from '@coreui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export function SuspendedPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const segmentBase = user?.tenant_segment === 'RECYCLING' ? '/recycling' : '/workshop';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <CCard style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <CCardBody className="p-5">
          <h2 className="fw-bold mb-3" style={{ color: 'var(--cui-danger)' }}>Sua assinatura foi suspensa</h2>
          <p className="text-secondary mb-4">
            Pague a fatura em aberto para reativar imediatamente sua conta.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CButton color="primary" onClick={() => navigate(`${segmentBase}/settings`)}>
              Ver fatura e pagar
            </CButton>
            <CButton color="secondary" variant="ghost" onClick={() => { logout(); navigate('/'); }}>
              Sair
            </CButton>
            <a href="mailto:suporte@praktikus.com.br" style={{ fontSize: 13, color: '#5b6868' }}>
              Falar com suporte
            </a>
          </div>
        </CCardBody>
      </CCard>
    </div>
  );
}
