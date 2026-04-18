import { CButton, CCard, CCardBody } from '@coreui/react';

const segments = [
  {
    icon: '🔧',
    title: 'Oficina Mecânica',
    description: 'Gestão completa de OS, agendamentos e clientes para oficinas e auto centers.',
    available: true,
    registerPath: '/register',
  },
  {
    icon: '♻️',
    title: 'Recicláveis',
    description: 'Gestão de compras, estoque, caixa e vendas para recicladoras.',
    available: true,
    registerPath: '/register/recycling',
  },
  {
    icon: '🏥',
    title: 'Clínica Médica',
    description: 'Prontuários, agendamentos e gestão de pacientes.',
    available: false,
  },
  {
    icon: '🦷',
    title: 'Odontologia',
    description: 'Gestão de consultas, orçamentos e histórico odontológico.',
    available: false,
  },
];

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center px-4 py-3">
        <span className="fw-bold fs-5 text-primary">Praktikus</span>
        <div className="d-flex gap-2">
          <CButton color="secondary" variant="ghost" href="/login">Entrar</CButton>
          <CButton color="primary" href="/register">Começar grátis</CButton>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center py-5 px-3">
        <h1 className="fw-bold mb-3">Gerencie seu negócio com inteligência</h1>
        <p className="text-secondary mb-4 fs-5">
          30 dias grátis, sem cartão de crédito. Depois, apenas R$69,90/mês.
        </p>
        <CButton color="primary" size="lg" href="/register" className="px-5">
          Começar gratuitamente
        </CButton>
      </div>

      {/* Segment cards */}
      <div className="container py-5">
        <h4 className="fw-bold text-center mb-4">Escolha seu segmento</h4>
        <div className="row justify-content-center g-4">
          {segments.map((seg) => (
            <div key={seg.title} className="col-12 col-sm-6 col-md-4">
              <CCard style={{ height: '100%', position: 'relative' }}>
                {!seg.available && (
                  <span
                    className="badge bg-secondary"
                    style={{ position: 'absolute', top: 12, right: 12 }}
                  >
                    Em breve
                  </span>
                )}
                <CCardBody className="d-flex flex-column align-items-center text-center pt-4">
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{seg.icon}</div>
                  <h6 className="fw-bold mt-2 mb-1">{seg.title}</h6>
                  <p className="text-secondary small mb-3">{seg.description}</p>
                  <div className="mt-auto">
                    {seg.available ? (
                      <CButton color="primary" href={seg.registerPath ?? '/register'}>Começar grátis</CButton>
                    ) : (
                      <CButton color="secondary" variant="outline" disabled>Em breve</CButton>
                    )}
                  </div>
                </CCardBody>
              </CCard>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
