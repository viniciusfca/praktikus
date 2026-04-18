import { useState } from 'react';
import { CButton } from '@coreui/react';
import { Logo } from '../components/Logo';

// ── Data ────────────────────────────────────────────────────────────────────

const segments = [
  {
    emoji: '🔧',
    name: 'Oficina Mecânica',
    desc: 'Gestão completa de OS, agendamentos, peças e clientes para oficinas de todo porte.',
    live: true,
    path: '/register',
  },
  {
    emoji: '♻️',
    name: 'Recicláveis',
    desc: 'Controle de compras, estoque, caixa e vendas para ferro-velho e cooperativas.',
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

const features = [
  { emoji: '⚡', title: 'Configure em minutos', desc: 'Onboarding guiado por segmento. Seus primeiros agendamentos e OS em menos de 10 min.' },
  { emoji: '🔒', title: 'Dados seguros e exportáveis', desc: 'Backups diários, LGPD-friendly. Seus dados são seus — exporte em CSV ou PDF quando quiser.' },
  { emoji: '💬', title: 'WhatsApp nativo', desc: 'Envie lembretes, orçamentos e links de aprovação direto pelo WhatsApp do cliente.' },
  { emoji: '📊', title: 'Relatórios que importam', desc: 'Faturamento, ticket médio, top serviços. Decisões baseadas em dados, não em intuição.' },
  { emoji: '🖨️', title: 'PDF profissional', desc: 'Ordens de serviço e orçamentos prontos para imprimir ou enviar, com sua marca.' },
  { emoji: '🏢', title: 'Multi-unidade', desc: 'Gerencie várias filiais com permissões granulares e relatórios consolidados.' },
];

const faqs = [
  { q: 'Como funciona o trial de 30 dias?', a: 'Você tem acesso a todos os recursos do plano Pro por 30 dias, sem precisar informar cartão de crédito. Ao final, você escolhe o plano que melhor se adapta à sua operação.' },
  { q: 'Posso mudar de plano depois?', a: 'Sim. Você pode fazer upgrade ou downgrade a qualquer momento direto pelo painel, e nós fazemos o prorata automaticamente.' },
  { q: 'E se eu atender mais de um segmento?', a: 'Sem problema. Um único login pode alternar entre áreas (ex.: oficina e recicláveis) e cada uma mantém seus dados, equipe e relatórios separados.' },
  { q: 'Meus dados ficam seguros?', a: 'Sim. Infraestrutura na nuvem com criptografia em repouso e em trânsito, backups diários automáticos e conformidade com a LGPD.' },
  { q: 'Preciso instalar algo?', a: 'Não. Praktikus roda 100% no navegador — também temos app PWA instalável no celular para usar offline em casos pontuais.' },
];

// ── Hero mockup ──────────────────────────────────────────────────────────────

function HeroMockup() {
  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid var(--cui-border-color)',
      boxShadow: '0 20px 48px rgba(10,12,13,0.14)',
      background: 'var(--cui-card-bg)',
    }}>
      {/* browser chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 14px', borderBottom: '1px solid var(--cui-border-color)',
        background: 'var(--cui-card-cap-bg)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F56' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27C93F' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--cui-secondary-color)', fontFamily: 'JetBrains Mono, monospace' }}>
          app.praktikus.com.br/dashboard
        </span>
      </div>
      {/* mini app */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', minHeight: 300 }}>
        <div style={{ borderRight: '1px solid var(--cui-border-color)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ marginBottom: 12 }}>
            <Logo size={13} />
          </div>
          {['Dashboard', 'Agendamentos', 'OS', 'Clientes', 'Veículos'].map((item, i) => (
            <div key={item} style={{
              padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? 'var(--cui-primary)' : 'var(--cui-secondary-color)',
              background: i === 0 ? 'rgba(52,142,145,0.1)' : 'transparent',
            }}>
              {item}
            </div>
          ))}
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--cui-body-color)' }}>Bom dia, Vini 👋</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'OS abertas', value: '24' },
              { label: 'Faturamento', value: 'R$ 18.4k' },
              { label: 'Agendamentos', value: '47' },
              { label: 'Ticket médio', value: 'R$ 386' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--cui-border-color)',
                background: 'var(--cui-card-bg)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--cui-secondary-color)', marginBottom: 3 }}>{kpi.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cui-body-color)' }}>{kpi.value}</div>
              </div>
            ))}
          </div>
          <div style={{
            height: 60, borderRadius: 8,
            border: '1px solid var(--cui-border-color)',
            background: 'linear-gradient(135deg, rgba(52,142,145,0.06) 0%, rgba(28,80,82,0.04) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--cui-secondary-color)',
          }}>
            📈 Gráfico de faturamento
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────────────────

interface Plan {
  name: string;
  price: number;
  desc: string;
  features: string[];
  cta: string;
  featured?: boolean;
  billing: 'monthly' | 'annual';
}

function PlanCard({ plan }: { plan: Plan }) {
  const featured = plan.featured ?? false;
  return (
    <div style={{
      position: 'relative',
      padding: 28, borderRadius: 14,
      border: `1px solid ${featured ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
      background: 'var(--cui-card-bg)',
      display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: featured ? '0 0 0 3px rgba(52,142,145,0.15)' : undefined,
    }}>
      {featured && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--cui-primary)', color: '#fff',
          padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          Mais popular
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cui-secondary-color)' }}>
        {plan.name}
      </p>
      <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--cui-body-color)' }}>
        R$ {plan.price.toFixed(2).replace('.', ',')}
        <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--cui-secondary-color)' }}>
          /{plan.billing === 'annual' ? 'mês, anual' : 'mês'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>{plan.desc}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5 }}>
            <span style={{ color: 'var(--cui-primary)', flexShrink: 0, marginTop: 1 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
        <CButton
          color="primary"
          variant={featured ? undefined : 'outline'}
          href="/register"
          style={{ width: '100%', borderRadius: 8 }}
        >
          {plan.cta}
        </CButton>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function LandingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [faqOpen, setFaqOpen] = useState<number>(-1);

  const plans: Plan[] = [
    {
      name: 'Starter', billing,
      price: billing === 'annual' ? 49 : 59,
      desc: '1 usuário, ideal para autônomos.',
      features: ['Até 50 OS/mês', 'Agenda e clientes', 'PDF e WhatsApp', 'Suporte por e-mail'],
      cta: 'Começar grátis',
    },
    {
      name: 'Pro', billing, featured: true,
      price: billing === 'annual' ? 69.90 : 89,
      desc: 'Para oficinas em crescimento.',
      features: ['OS e agendamentos ilimitados', 'Até 5 usuários', 'Relatórios avançados', 'Integração WhatsApp Business', 'Suporte prioritário'],
      cta: 'Começar grátis',
    },
    {
      name: 'Business', billing,
      price: billing === 'annual' ? 149 : 189,
      desc: 'Multi-unidade e equipes grandes.',
      features: ['Tudo do Pro', 'Usuários ilimitados', 'Multi-unidade', 'API e integrações', 'Gerente dedicado'],
      cta: 'Falar com vendas',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cui-body-bg)', color: 'var(--cui-body-color)' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 20,
        backdropFilter: 'blur(12px)',
        background: 'rgba(var(--cui-body-bg-rgb, 251,251,250), 0.85)',
        borderBottom: '1px solid var(--cui-border-color)',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 24 }}>
          <Logo size={22} />
          <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
            {[['#segments', 'Segmentos'], ['#features', 'Recursos'], ['#pricing', 'Preços'], ['#faq', 'FAQ']].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13.5, color: 'var(--cui-secondary-color)', textDecoration: 'none', transition: 'color 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--cui-body-color)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--cui-secondary-color)')}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <CButton color="secondary" variant="ghost" href="/login" size="sm" style={{ borderRadius: 8 }}>Entrar</CButton>
            <CButton color="primary" href="/register" size="sm" style={{ borderRadius: 8 }}>Começar grátis →</CButton>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '64px 24px 48px', display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px 4px 6px', border: '1px solid var(--cui-border-color)',
            background: 'var(--cui-card-bg)', borderRadius: 999, fontSize: 12.5,
            color: 'var(--cui-secondary-color)', marginBottom: 22,
          }}>
            <span style={{ background: 'rgba(52,142,145,0.12)', color: 'var(--cui-primary)', fontWeight: 600, padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>Novo</span>
            <span><strong style={{ color: 'var(--cui-body-color)' }}>Relatórios v2</strong> — ticket médio e funil de aprovação</span>
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 5vw, 54px)', lineHeight: 1.03, letterSpacing: '-0.035em', fontWeight: 600, margin: '0 0 16px', color: 'var(--cui-body-color)' }}>
            Gestão{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'var(--cui-primary)', fontWeight: 400 }}>inteligente</em>
            {' '}para o seu negócio de serviços.
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--cui-secondary-color)', maxWidth: 520, margin: '0 0 28px' }}>
            Uma plataforma feita para oficinas, clínicas, ferro-velhos e mais. Agenda, ordens de serviço, clientes, estoque e relatórios — sem planilha, sem complicação.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <CButton color="primary" size="lg" href="/register" style={{ borderRadius: 8 }}>
              Começar 30 dias grátis →
            </CButton>
            <CButton color="secondary" variant="outline" size="lg" style={{ borderRadius: 8 }}>
              Ver demonstração
            </CButton>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--cui-secondary-color)' }}>
            {['Sem cartão de crédito', 'Cancele quando quiser', 'Suporte em português'].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'var(--cui-primary)', fontWeight: 700 }}>✓</span> {t}
              </span>
            ))}
          </div>
        </div>
        <HeroMockup />
      </section>

      {/* ── SEGMENTS ─────────────────────────────────────────────────────── */}
      <section id="segments" style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 72px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Escolha seu segmento</h2>
          <p style={{ color: 'var(--cui-secondary-color)', margin: 0 }}>Uma base sólida, adaptada às particularidades da sua operação.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
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
      <section id="features" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 10px' }}>
            Tudo o que você precisa,{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'var(--cui-primary)', fontWeight: 400 }}>nada que você não</em>.
          </h2>
          <p style={{ color: 'var(--cui-secondary-color)', margin: 0 }}>Um único sistema, seis superpoderes.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {features.map(f => (
            <div key={f.title} style={{
              padding: 24, borderRadius: 14,
              border: '1px solid var(--cui-border-color)',
              background: 'var(--cui-card-bg)',
            }}>
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

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ maxWidth: 1180, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em', margin: '0 0 10px' }}>
            Preços{' '}
            <em style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", color: 'var(--cui-primary)', fontWeight: 400 }}>honestos</em>.
          </h2>
          <p style={{ color: 'var(--cui-secondary-color)', margin: '0 0 20px', fontSize: 15 }}>30 dias grátis em qualquer plano. Sem cartão de crédito.</p>

          {/* billing toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 3, background: 'var(--cui-secondary-bg, #f4f5f5)', borderRadius: 10, border: '1px solid var(--cui-border-color)' }}>
            {(['monthly', 'annual'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                style={{
                  padding: '6px 16px', border: 0, cursor: 'pointer', borderRadius: 7,
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  background: billing === b ? 'var(--cui-card-bg)' : 'transparent',
                  color: billing === b ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                  boxShadow: billing === b ? '0 1px 3px rgba(10,12,13,0.07)' : 'none',
                  transition: 'all 0.12s',
                }}
              >
                {b === 'monthly' ? 'Mensal' : 'Anual'}
              </button>
            ))}
          </div>
          {billing === 'annual' && (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '2px 8px', borderRadius: 999 }}>
              Economize 22%
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'stretch' }}>
          {plans.map(plan => <PlanCard key={plan.name} plan={plan} />)}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ maxWidth: 780, margin: '0 auto', padding: '20px 24px 80px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 28px' }}>Perguntas frequentes</h2>
        {faqs.map((faq, i) => (
          <div
            key={i}
            onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
            style={{ borderBottom: '1px solid var(--cui-border-color)', padding: '16px 0', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 550, fontSize: 15 }}>
              <span>{faq.q}</span>
              <span style={{ color: 'var(--cui-primary)', fontSize: 18, flexShrink: 0, marginLeft: 12 }}>
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
      <footer style={{ borderTop: '1px solid var(--cui-border-color)', background: 'var(--cui-card-cap-bg)', padding: '40px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between', color: 'var(--cui-secondary-color)', fontSize: 13 }}>
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
