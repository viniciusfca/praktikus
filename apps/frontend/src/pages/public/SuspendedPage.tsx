import { CButton, CCard, CCardBody } from '@coreui/react';

export function SuspendedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <CCardBody className="p-5">
          <h2 className="fw-bold mb-3" style={{ color: 'var(--cui-danger)' }}>
            Conta Suspensa
          </h2>
          <p className="text-secondary mb-4">
            O acesso à sua conta foi suspenso por inadimplência. Regularize o
            pagamento para reativar o sistema.
          </p>
          <CButton
            color="primary"
            href="https://www.asaas.com/login"
            target="_blank"
            rel="noopener noreferrer"
          >
            Regularizar pagamento
          </CButton>
        </CCardBody>
      </CCard>
    </div>
  );
}
