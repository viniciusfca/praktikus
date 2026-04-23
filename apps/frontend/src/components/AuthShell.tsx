import type { ReactNode } from 'react';
import { Logo } from './Logo';

interface AuthShellProps {
  children: ReactNode;
}

const bullets = [
  'Ordens de serviço completas com histórico por cliente',
  'Agenda, WhatsApp e lembretes automáticos',
  'Relatórios de faturamento e ticket médio em tempo real',
];

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        background: 'var(--cui-body-bg)',
      }}
      className="pk-auth-shell"
    >
      {/* ── Form side ───────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <Logo size={24} />
          </div>
          {children}
        </div>
      </div>

      {/* ── Aside (marketing) ───────────────────────────────────────────── */}
      <aside
        className="pk-auth-aside"
        style={{
          background: '#213635',
          color: '#EEF2F2',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* glow background */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 20% 30%, rgba(52,142,145,0.35), transparent 50%), radial-gradient(circle at 80% 80%, rgba(85,141,143,0.2), transparent 50%)',
            opacity: 0.85,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#CDE6E6',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            ✦ 30 dias grátis
          </span>
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          <h2
            style={{
              fontSize: 34,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              fontWeight: 600,
              margin: '0 0 14px',
              color: '#F2F5F5',
            }}
          >
            Menos planilha.
            <br />
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                color: '#7BC4C6',
                fontWeight: 400,
              }}
            >
              Mais negócio.
            </span>
          </h2>
          <p style={{ color: '#C3D0D0', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            Mais de 2 mil negócios de serviço já trocaram a bagunça pela clareza do Praktikus.
          </p>
          <div style={{ marginTop: 36, display: 'grid', gap: 12 }}>
            {bullets.map((t) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  fontSize: 14,
                  color: '#D9E3E3',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: '#348E91',
                    color: '#06201F',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  ✓
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontSize: 12.5, color: '#94A5A5' }}>
          © 2026 Praktikus
        </div>
      </aside>
    </div>
  );
}
