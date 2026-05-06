import { useEffect, useRef, useState } from 'react';
import { CButton } from '@coreui/react';
import { Logo } from '../components/Logo';

// ── Data ────────────────────────────────────────────────────────────────────

const segments = [
  {
    emoji: '🔧',
    name: 'Oficina Mecânica',
    desc: 'Gestão completa de OS, agendamentos, peças e clientes para oficinas de todo porte.',
    live: true,
    path: '/register/workshop',
  },
  {
    emoji: '♻️',
    name: 'Recicladoras',
    desc: 'Controle de compras, estoque, caixa e vendas para cooperativas e recicladoras.',
    live: true,
    path: '/register/recycling',
  },
  {
    emoji: '🏥',
    name: 'Clínica Médica',
    desc: 'Prontuários, agendamentos e gestão completa de pacientes e convênios.',
    live: false,
  },
  {
    emoji: '🦷',
    name: 'Odontologia',
    desc: 'Gestão de consultas, orçamentos e histórico odontológico detalhado.',
    live: false,
  },
];

const features: { emoji: string; title: string; desc: string; soon?: boolean }[] = [
  { emoji: '⚡', title: 'Configure em minutos', desc: 'Onboarding guiado por segmento. Seus primeiros agendamentos e OS em menos de 10 min.' },
  { emoji: '🔒', title: 'Dados seguros e exportáveis', desc: 'Backups diários, LGPD-friendly. Seus dados são seus — exporte em CSV ou PDF quando quiser.' },
  { emoji: '✨', title: 'Feito no Brasil', desc: 'Suporte em português, adaptado à realidade de pequenos e médios negócios brasileiros.' },
  { emoji: '📊', title: 'Relatórios que importam', desc: 'Faturamento, ticket médio, top serviços. Decisões baseadas em dados, não em intuição.' },
  { emoji: '🖨️', title: 'PDF profissional', desc: 'Ordens de serviço, orçamentos e tabelas de preço prontos para imprimir ou enviar.' },
  { emoji: '💳', title: 'Cobrança automática', desc: 'PIX, cartão e recorrência via Asaas. Inadimplência tratada automaticamente — você não precisa lembrar.' },
  { emoji: '💬', title: 'WhatsApp integrado', desc: 'Atendimento e notificações pelo número da sua empresa, direto do Praktikus.', soon: true },
];

const plan = {
  name: 'Praktikus Pro',
  price: 89.90,
  desc: 'Acesso completo, sem limites, sem surpresas.',
  universal: [
    'Cadastros e movimentações ilimitados',
    'Relatórios mensais e exportação em PDF/CSV',
    'Suporte em português',
  ],
  workshop: [
    'Agenda, OS e prontuário',
    'Clientes e veículos com histórico',
    'Catálogo de serviços e peças',
  ],
  recycling: [
    'Compras, vendas e caixa',
    'Estoque por material',
    'Múltiplas tabelas de preço',
    'Coletas agendadas',
  ],
};

const faqs = [
  { q: 'Como funciona o trial de 30 dias?', a: 'Você tem acesso a todos os recursos por 30 dias para testar à vontade. Ao final do período, basta ativar a assinatura para continuar sem perder seus dados.' },
  { q: 'Como é a cobrança?', a: 'Mensalidade única de R$ 89,90 no cartão de crédito, processada de forma segura via Asaas. Você pode cancelar a qualquer momento direto pelo painel.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim. O cancelamento é feito direto pelo painel, sem multa e sem burocracia. Seus dados ficam disponíveis para exportação por 30 dias após o cancelamento.' },
  { q: 'Meus dados ficam seguros?', a: 'Sim. Infraestrutura na nuvem com criptografia em repouso e em trânsito, backups diários automáticos e conformidade com a LGPD.' },
  { q: 'Preciso instalar algo?', a: 'Não. Praktikus roda 100% no navegador, em qualquer dispositivo — basta acessar app.praktikus.com.br. Layout responsivo para celular e tablet.' },
];

// ── Mobile detection hook ───────────────────────────────────────────────────
// Keeps parity with AppLayout/RecyclingLayout pattern.
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// ── Hero mockup ──────────────────────────────────────────────────────────────

type HeroVariant = 'workshop' | 'recycling';

interface HeroMockupContent {
  menu: string[];
  kpis: { label: string; value: string }[];
  chartLabel: string;
  ariaLabel: string;
}

const HERO_CONTENT: Record<HeroVariant, HeroMockupContent> = {
  workshop: {
    menu: ['Dashboard', 'Agendamentos', 'OS', 'Clientes', 'Veículos'],
    kpis: [
      { label: 'OS abertas', value: '24' },
      { label: 'Faturamento', value: 'R$ 18.4k' },
      { label: 'Agendamentos', value: '47' },
      { label: 'Ticket médio', value: 'R$ 386' },
    ],
    chartLabel: '📈 Gráfico de faturamento',
    ariaLabel: 'Pré-visualização do painel para oficinas',
  },
  recycling: {
    menu: ['Dashboard', 'Compras', 'Vendas', 'Caixa', 'Estoque'],
    kpis: [
      { label: 'Compras hoje', value: 'R$ 4.2k' },
      { label: 'Faturamento', value: 'R$ 22.7k' },
      { label: 'Caixa', value: 'R$ 1.840' },
      { label: 'Estoque', value: '8.4t' },
    ],
    chartLabel: '📈 Compras por material',
    ariaLabel: 'Pré-visualização do painel para recicladoras',
  },
};

function HeroMockup({ compact, variant }: { compact: boolean; variant: HeroVariant }) {
  const content = HERO_CONTENT[variant];
  return (
    // NOSONAR(rule:S6819) — mockup é uma árvore DOM sintetizada (browser chrome + sidebar + KPIs), não uma imagem real; role="img" é o padrão ARIA correto para apresentar todo o bloco como um único gráfico decorativo-informativo a leitores de tela.
    <div
      role="img"
      aria-label={content.ariaLabel}
      style={{
        borderRadius: 14, overflow: 'hidden',
        border: '1px solid var(--cui-border-color)',
        boxShadow: '0 20px 48px rgba(10,12,13,0.14)',
        background: 'var(--cui-card-bg)',
      }}
    >
      {/* browser chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: compact ? '8px 12px' : '10px 14px',
        borderBottom: '1px solid var(--cui-border-color)',
        background: 'var(--cui-card-cap-bg)',
      }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F56' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFBD2E' }} />
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#27C93F' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: 'var(--cui-secondary-color)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          app.praktikus.com.br/dashboard
        </span>
      </div>
      {/* mini app */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '96px 1fr' : '120px 1fr', minHeight: compact ? 240 : 300 }}>
        <div style={{ borderRight: '1px solid var(--cui-border-color)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ marginBottom: 12 }}>
            <Logo size={12} />
          </div>
          {content.menu.map((item, i) => (
            <div key={item} style={{
              padding: '6px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
              background: i === 0 ? 'rgba(52,142,145,0.1)' : 'transparent',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {item}
            </div>
          ))}
        </div>
        <div style={{ padding: compact ? 12 : 14, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10, color: 'var(--cui-body-color)' }}>Bom dia, Vini 👋</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {content.kpis.map(kpi => (
              <div key={kpi.label} style={{
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--cui-border-color)',
                background: 'var(--cui-card-bg)',
                minWidth: 0,
              }}>
                <div style={{ fontSize: 10, color: 'var(--cui-secondary-color)', marginBottom: 3 }}>{kpi.label}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cui-body-color)', whiteSpace: 'nowrap' }}>{kpi.value}</div>
              </div>
            ))}
          </div>
          <div style={{
            height: 56, borderRadius: 8,
            border: '1px solid var(--cui-border-color)',
            background: 'linear-gradient(135deg, rgba(52,142,145,0.06) 0%, rgba(28,80,82,0.04) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--cui-secondary-color)',
          }}>
            {content.chartLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function LandingPage() {
  const [faqOpen, setFaqOpen] = useState<number>(-1);
  const isMobile = useIsMobile();

  const [heroVariant, setHeroVariant] = useState<HeroVariant>('workshop');
  const heroPausedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      if (heroPausedRef.current) return;
      setHeroVariant(v => (v === 'workshop' ? 'recycling' : 'workshop'));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const containerPad = isMobile ? '0 18px' : '0 24px';
  const sectionMaxWidth = 1180;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cui-body-bg)', color: 'var(--cui-body-color)' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 20,
        backdropFilter: 'blur(12px)',
        background: 'rgba(var(--cui-body-bg-rgb, 251,251,250), 0.85)',
        borderBottom: '1px solid var(--cui-border-color)',
      }}>
        <div style={{
          maxWidth: sectionMaxWidth, margin: '0 auto', padding: containerPad,
          height: 56, display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24,
        }}>
          <Logo size={22} />
          {!isMobile && (
            <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
              {[['#segments', 'Segmentos'], ['#features', 'Recursos'], ['#pricing', 'Preços'], ['#faq', 'FAQ']].map(([href, label]) => (
                <a key={href} href={href} style={{ fontSize: 13.5, color: 'var(--cui-secondary-color)', textDecoration: 'none', transition: 'color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--cui-body-color)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--cui-secondary-color)')}>
                  {label}
                </a>
              ))}
            </div>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <CButton color="primary" href="/login" size="sm" style={{ borderRadius: 8 }}>Entrar →</CButton>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: sectionMaxWidth, margin: '0 auto',
        padding: isMobile ? '36px 18px 32px' : '64px 24px 48px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.05fr 1fr',
        gap: isMobile ? 32 : 56,
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{
            fontSize: 'clamp(30px, 7vw, 54px)',
            lineHeight: 1.05, letterSpacing: '-0.035em', fontWeight: 600,
            margin: '0 0 14px', color: 'var(--cui-body-color)',
          }}>
            Gestão{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'var(--cui-primary)', fontWeight: 400 }}>inteligente</em>
            {' '}para o seu negócio de serviços.
          </h1>

          <p style={{
            fontSize: isMobile ? 15.5 : 17,
            lineHeight: 1.55, color: 'var(--cui-secondary-color)',
            maxWidth: 520, margin: '0 0 24px',
          }}>
            Plataforma feita para oficinas e recicladoras. Agenda, ordens de serviço, compras, vendas, estoque e relatórios — sem planilha, sem complicação.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <CButton
              color="primary" size="lg" href="/register"
              style={{ borderRadius: 8, flex: isMobile ? '1 1 100%' : '0 0 auto' }}
            >
              Começar 30 dias grátis →
            </CButton>
            <CButton
              color="secondary" variant="outline" size="lg"
              style={{ borderRadius: 8, flex: isMobile ? '1 1 100%' : '0 0 auto' }}
            >
              Ver demonstração
            </CButton>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: isMobile ? 12 : 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--cui-secondary-color)' }}>
            {['30 dias grátis', 'Cancele quando quiser', 'Suporte em português'].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'var(--cui-primary)', fontWeight: 700 }}>✓</span> {t}
              </span>
            ))}
          </div>
        </div>
        {/* NOSONAR(rule:S6848) — wrapper detecta apenas hover para pausar o auto-swap; não há onClick/keyboard/touch porque é uma feature passiva (a interação ativa fica no HeroMockup interno, que já tem role="img" e aria-label). */}
        <div
          onMouseEnter={() => { heroPausedRef.current = true; }}
          onMouseLeave={() => { heroPausedRef.current = false; }}
        >
          <HeroMockup compact={isMobile} variant={heroVariant} />
        </div>
      </section>

      {/* ── SEGMENTS ─────────────────────────────────────────────────────── */}
      <section id="segments" style={{
        maxWidth: sectionMaxWidth, margin: '0 auto',
        padding: isMobile ? '20px 18px 56px' : '24px 24px 72px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 32 }}>
          <h2 style={{ fontSize: 'clamp(22px, 4.2vw, 28px)', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
            Escolha seu segmento
          </h2>
          <p style={{ color: 'var(--cui-secondary-color)', margin: 0, fontSize: isMobile ? 14 : 15 }}>
            Uma base sólida, adaptada às particularidades da sua operação.
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}>
          {segments.map(seg => (
            <div
              key={seg.name}
              onClick={() => seg.live && (window.location.href = seg.path!)}
              style={{
                padding: 22, borderRadius: 14,
                border: '1px solid var(--cui-border-color)',
                background: 'var(--cui-card-bg)',
                display: 'flex', flexDirection: 'column', gap: 10,
                position: 'relative', cursor: seg.live ? 'pointer' : 'not-allowed',
                opacity: seg.live ? 1 : 0.72,
                transition: 'border-color 0.15s, transform 0.18s, box-shadow 0.18s',
              }}
              onMouseEnter={e => {
                if (!seg.live || isMobile) return;
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
                  position: 'absolute', top: 12, right: 12,
                  fontSize: 11, fontWeight: 600, padding: '2px 8px',
                  borderRadius: 999, background: 'var(--cui-secondary-bg, #f4f5f5)',
                  color: 'var(--cui-secondary-color)', border: '1px solid var(--cui-border-color)',
                }}>
                  Em breve
                </span>
              )}
              <div style={{
                width: 40, height: 40, borderRadius: 12, fontSize: 20,
                background: 'rgba(52,142,145,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {seg.emoji}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{seg.name}</div>
              <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)', lineHeight: 1.5, flex: 1 }}>{seg.desc}</div>
              {seg.live ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--cui-primary)', fontSize: 13, fontWeight: 600 }}>
                  Começar <span>→</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>Em breve</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" style={{
        maxWidth: sectionMaxWidth, margin: '0 auto',
        padding: isMobile ? '32px 18px' : '40px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 40 }}>
          <h2 style={{ fontSize: 'clamp(24px, 4.6vw, 32px)', fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 10px' }}>
            Tudo o que você precisa,{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'var(--cui-primary)', fontWeight: 400 }}>nada que você não</em>.
          </h2>
          <p style={{ color: 'var(--cui-secondary-color)', margin: 0, fontSize: isMobile ? 14 : 15 }}>
            Um único sistema, sete superpoderes.
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {features.map(f => (
            <div key={f.title} style={{
              position: 'relative',
              padding: isMobile ? 20 : 24, borderRadius: 14,
              border: '1px solid var(--cui-border-color)',
              background: 'var(--cui-card-bg)',
            }}>
              {f.soon && (
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  fontSize: 11, fontWeight: 600, padding: '2px 8px',
                  borderRadius: 999, background: 'var(--cui-secondary-bg, #f4f5f5)',
                  color: 'var(--cui-secondary-color)', border: '1px solid var(--cui-border-color)',
                }}>
                  Em breve
                </span>
              )}
              <div style={{
                width: 36, height: 36, borderRadius: 10, fontSize: 18,
                background: 'rgba(52,142,145,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
              }}>
                {f.emoji}
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--cui-secondary-color)', lineHeight: 1.55 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING — plano único ───────────────────────────────────────── */}
      <section id="pricing" style={{
        maxWidth: sectionMaxWidth, margin: '0 auto',
        padding: isMobile ? '44px 18px' : '60px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 36 }}>
          <h2 style={{ fontSize: 'clamp(26px, 5vw, 34px)', fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 10px' }}>
            Preço{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'var(--cui-primary)', fontWeight: 400 }}>honesto</em>, plano único.
          </h2>
          <p style={{ color: 'var(--cui-secondary-color)', margin: 0, fontSize: isMobile ? 14 : 15 }}>
            30 dias grátis para testar. Depois, uma mensalidade só.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? 0 : '0 24px' }}>
          <div style={{
            position: 'relative',
            maxWidth: 460, width: '100%',
            padding: isMobile ? 24 : 32, borderRadius: 16,
            border: '1px solid var(--cui-primary)',
            background: 'var(--cui-card-bg)',
            boxShadow: '0 0 0 3px rgba(52,142,145,0.15), 0 10px 30px rgba(52,142,145,0.08)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--cui-primary)', color: '#fff',
              padding: '4px 14px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              Plano único
            </div>

            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cui-secondary-color)' }}>
              {plan.name}
            </p>

            <div style={{ fontSize: 'clamp(38px, 9vw, 46px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--cui-body-color)' }}>
              R$ {plan.price.toFixed(2).replace('.', ',')}
              <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--cui-secondary-color)' }}> /mês</span>
            </div>

            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--cui-secondary-color)', lineHeight: 1.5 }}>{plan.desc}</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plan.universal.map(f => (
                <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 }}>
                  <span style={{ color: 'var(--cui-primary)', flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: isMobile ? 16 : 20,
              marginTop: 4,
              paddingTop: 16,
              borderTop: '1px solid var(--cui-border-color)',
            }}>
              {(['workshop', 'recycling'] as const).map(seg => (
                <div key={seg}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--cui-secondary-color)',
                    marginBottom: 8,
                  }}>
                    {seg === 'workshop' ? 'Para oficinas' : 'Para recicladoras'}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan[seg].map(item => (
                      <li key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--cui-body-color)' }}>
                        <span style={{ color: 'var(--cui-primary)', flexShrink: 0, marginTop: 1 }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <CButton
              color="primary"
              size="lg"
              href="/register"
              style={{ width: '100%', borderRadius: 10, marginTop: 4 }}
            >
              Começar 30 dias grátis →
            </CButton>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--cui-secondary-color)', margin: 0 }}>
              Cobrança segura via Asaas · Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" style={{
        maxWidth: 780, margin: '0 auto',
        padding: isMobile ? '16px 18px 56px' : '20px 24px 80px',
      }}>
        <h2 style={{
          fontSize: 'clamp(22px, 4.4vw, 28px)',
          fontWeight: 600, letterSpacing: '-0.02em',
          textAlign: 'center', margin: '0 0 24px',
        }}>
          Perguntas frequentes
        </h2>
        {faqs.map((faq, i) => (
          <div
            key={i}
            onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
            style={{ borderBottom: '1px solid var(--cui-border-color)', padding: '14px 0', cursor: 'pointer' }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontWeight: 550, fontSize: isMobile ? 14.5 : 15, gap: 12,
            }}>
              <span>{faq.q}</span>
              <span style={{ color: 'var(--cui-primary)', fontSize: 18, flexShrink: 0 }}>
                {faqOpen === i ? '−' : '+'}
              </span>
            </div>
            {faqOpen === i && (
              <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--cui-secondary-color)', lineHeight: 1.6 }}>
                {faq.a}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--cui-border-color)',
        background: 'var(--cui-card-cap-bg)',
        padding: isMobile ? '28px 18px' : '40px 24px',
      }}>
        <div style={{
          maxWidth: sectionMaxWidth, margin: '0 auto',
          display: 'flex', flexWrap: 'wrap',
          gap: isMobile ? 14 : 20,
          alignItems: 'center',
          justifyContent: isMobile ? 'center' : 'space-between',
          textAlign: isMobile ? 'center' : 'left',
          color: 'var(--cui-secondary-color)', fontSize: 13,
        }}>
          <Logo size={20} />
          <span>© 2026 Praktikus · Feito no Brasil 🇧🇷</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Privacidade', 'Termos', 'Status'].map(l => (
              <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--cui-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
