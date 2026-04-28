import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/AuthShell';

interface Segment {
  emoji: string;
  name: string;
  desc: string;
  live: boolean;
  path?: string;
}

const segments: Segment[] = [
  { emoji: '🔧', name: 'Oficina Mecânica', desc: 'OS, agendamentos, peças e clientes.', live: true, path: '/register/workshop' },
  { emoji: '♻️', name: 'Recicladoras', desc: 'Compras, estoque, caixa e vendas.', live: true, path: '/register/recycling' },
  { emoji: '🏥', name: 'Clínica Médica', desc: 'Em breve.', live: false },
  { emoji: '🦷', name: 'Odontologia', desc: 'Em breve.', live: false },
];

export function RegisterSegmentPage() {
  const navigate = useNavigate();

  return (
    <AuthShell>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, letterSpacing: '-0.02em', fontWeight: 600 }}>
        Vamos começar
      </h1>
      <p style={{ margin: '0 0 24px', color: 'var(--cui-secondary-color)' }}>
        Selecione o segmento da sua empresa para configurar seu cadastro.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {segments.map(seg => (
          <div
            key={seg.name}
            role={seg.live ? 'button' : undefined}
            tabIndex={seg.live ? 0 : -1}
            aria-disabled={!seg.live}
            onClick={() => seg.live && seg.path && navigate(seg.path)}
            onKeyDown={(e) => {
              if (!seg.live || !seg.path) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(seg.path);
              }
            }}
            style={{
              padding: 18, borderRadius: 14,
              border: '1px solid var(--cui-border-color)',
              background: 'var(--cui-card-bg)',
              display: 'flex', flexDirection: 'column', gap: 8,
              position: 'relative', cursor: seg.live ? 'pointer' : 'not-allowed',
              opacity: seg.live ? 1 : 0.6,
              transition: 'border-color 0.15s, transform 0.18s, box-shadow 0.18s',
            }}
            onMouseEnter={e => {
              if (!seg.live) return;
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cui-primary)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px rgba(52,142,145,0.12)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cui-border-color)';
              (e.currentTarget as HTMLDivElement).style.transform = '';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
          >
            {!seg.live && (
              <span style={{
                position: 'absolute', top: 10, right: 10,
                fontSize: 10.5, fontWeight: 600, padding: '2px 7px',
                borderRadius: 999, background: 'var(--cui-secondary-bg, #f4f5f5)',
                color: 'var(--cui-secondary-color)', border: '1px solid var(--cui-border-color)',
              }}>
                Em breve
              </span>
            )}
            <div style={{
              width: 36, height: 36, borderRadius: 10, fontSize: 18,
              background: 'rgba(52,142,145,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {seg.emoji}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{seg.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', lineHeight: 1.45, flex: 1 }}>
              {seg.desc}
            </div>
            {seg.live && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                color: 'var(--cui-primary)', fontSize: 12.5, fontWeight: 600,
              }}>
                Começar <span>→</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--cui-secondary-color)',
        }}
      >
        Já tem conta?{' '}
        <Link to="/login" style={{ color: 'var(--cui-primary)', fontWeight: 500, textDecoration: 'none' }}>
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
