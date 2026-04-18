import { useMemo } from 'react';
import { CButton } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilCash,
  cilNotes,
  cilCalendar,
  cilChartLine,
  cilArrowTop,
  cilArrowBottom,
  cilCloudDownload,
  cilPlus,
  cilArrowRight,
} from '@coreui/icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { useAuthStore } from '../../store/auth.store';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ── Mock data (substituir por API na próxima iteração) ──────────────────────

const kpis = [
  { label: 'Faturamento (mês)', value: 'R$ 18.430', trend: '+12.4%', up: true, sub: 'vs mês anterior', icon: cilCash },
  { label: 'OS abertas', value: '24', trend: '+3', up: true, sub: '6 aguardam aprovação', icon: cilNotes },
  { label: 'Agendamentos (semana)', value: '47', trend: '+8', up: true, sub: '12 hoje', icon: cilCalendar },
  { label: 'Ticket médio', value: 'R$ 386', trend: '-2.1%', up: false, sub: 'últimos 30 dias', icon: cilChartLine },
];

const upcoming = [
  { t: '09:00', when: 'Hoje', c: 'Carlos Menezes', v: 'Fiat Strada — BRA2E19', s: 'Revisão 20.000 km', status: 'confirmed' as const },
  { t: '10:30', when: 'Hoje', c: 'Mariana Costa', v: 'VW Polo — FGH1234', s: 'Troca de óleo', status: 'confirmed' as const },
  { t: '14:00', when: 'Amanhã', c: 'Roberto Alves', v: 'Honda Civic — ABC1D23', s: 'Alinhamento', status: 'pending' as const },
  { t: '16:30', when: 'Amanhã', c: 'Juliana Reis', v: 'Toyota Corolla — XYZ9K88', s: 'Diagnóstico elétrico', status: 'confirmed' as const },
];

const recentOS = [
  { n: '#OS-F70CA311', c: 'Vinícius Moura', v: 'Honda HRV 2023', total: 'R$ 300,00', status: 'pending' as const },
  { n: '#OS-E92BD7A0', c: 'Ana Laura', v: 'Fiat Pulse 2024', total: 'R$ 1.280,00', status: 'approved' as const },
  { n: '#OS-D81FC223', c: 'Pedro Lima', v: 'Hyundai HB20', total: 'R$ 540,00', status: 'paid' as const },
  { n: '#OS-C73AE194', c: 'Camila Souza', v: 'Chevrolet Onix', total: 'R$ 820,00', status: 'in_progress' as const },
];

type OSStatus = 'pending' | 'approved' | 'paid' | 'in_progress' | 'confirmed';

const STATUS_MAP: Record<OSStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pendente',     color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  approved:    { label: 'Aprovado',     color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  paid:        { label: 'Pago',         color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  in_progress: { label: 'Em execução',  color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  confirmed:   { label: 'Confirmado',   color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
};

// ── Sub-components ──────────────────────────────────────────────────────────

function Card(props: { children: React.ReactNode; padding?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
        ...props.style,
      }}
    >
      <div style={{ padding: props.padding ?? 20 }}>{props.children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: OSStatus }) {
  const s = STATUS_MAP[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, trend, up, sub, icon }: (typeof kpis)[number]) {
  return (
    <div
      style={{
        padding: '18px 20px',
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--cui-secondary-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        <CIcon icon={icon} size="sm" style={{ width: 13, height: 13 }} />
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--cui-body-color)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: up ? '#16a34a' : '#dc2626',
        }}
      >
        <CIcon icon={up ? cilArrowTop : cilArrowBottom} style={{ width: 12, height: 12 }} />
        {trend}
        <span style={{ color: 'var(--cui-secondary-color)', fontWeight: 400, marginLeft: 4 }}>
          · {sub}
        </span>
      </div>
    </div>
  );
}

// ── Charts ──────────────────────────────────────────────────────────────────

function RevenueChart() {
  const data = useMemo(() => {
    const labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
    const servicos = labels.map((_, i) => 200 + Math.round(Math.sin(i / 3) * 80 + Math.random() * 120 + i * 3));
    const pecas = labels.map((_, i) => 120 + Math.round(Math.cos(i / 3.5) * 60 + Math.random() * 100 + i * 2));
    return { labels, servicos, pecas };
  }, []);

  return (
    <Bar
      height={220}
      data={{
        labels: data.labels,
        datasets: [
          {
            label: 'Serviços',
            data: data.servicos,
            backgroundColor: '#348E91',
            borderRadius: 3,
            stack: 'total',
          },
          {
            label: 'Peças',
            data: data.pecas,
            backgroundColor: '#1C5052',
            borderRadius: 3,
            stack: 'total',
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'start',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              padding: 14,
              font: { size: 12, weight: 500 },
              color: 'rgb(var(--cui-body-color-rgb, 15, 20, 20))',
              usePointStyle: true,
              pointStyle: 'rectRounded',
            },
          },
          tooltip: {
            backgroundColor: '#0A0C0D',
            titleColor: '#fff',
            bodyColor: '#e0e0e0',
            padding: 10,
            cornerRadius: 6,
            displayColors: true,
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: 'var(--cui-secondary-color)', font: { size: 10 } },
          },
          y: {
            stacked: true,
            grid: { color: 'var(--cui-border-color)' },
            ticks: { color: 'var(--cui-secondary-color)', font: { size: 10 } },
          },
        },
      }}
    />
  );
}

function StatusDonut() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: '100%', maxWidth: 220, aspectRatio: '1 / 1' }}>
        <Doughnut
          data={{
            labels: ['Em execução', 'Aguardando aprov.', 'Aguardando peça', 'Finalizada'],
            datasets: [
              {
                data: [10, 6, 4, 4],
                backgroundColor: ['#348E91', '#d97706', '#5b8a8d', '#16a34a'],
                borderWidth: 0,
              },
            ],
          }}
          options={{
            cutout: '70%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0A0C0D',
                titleColor: '#fff',
                bodyColor: '#e0e0e0',
                padding: 10,
                cornerRadius: 6,
              },
            },
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', width: '100%' }}>
        {[
          ['#348E91', 'Em execução', 10],
          ['#d97706', 'Aguard. aprov.', 6],
          ['#5b8a8d', 'Aguard. peça', 4],
          ['#16a34a', 'Finalizada', 4],
        ].map(([color, label, n]) => (
          <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color as string, flexShrink: 0 }} />
            <span style={{ color: 'var(--cui-secondary-color)', flex: 1 }}>{label as string}</span>
            <b style={{ fontWeight: 700, color: 'var(--cui-body-color)' }}>{n}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card header ─────────────────────────────────────────────────────────────

function CardHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '18px 20px 12px',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--cui-body-color)' }}>
          {title}
        </div>
        {desc && (
          <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = (user?.name ?? 'por aí').split(' ')[0];

  const today = new Date();
  const greeting =
    today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Page head ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            {greeting}, {firstName} 👋
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            Aqui está um resumo da sua oficina hoje, {dateStr}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <CButton color="secondary" variant="outline" style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CIcon icon={cilCloudDownload} size="sm" />
            Exportar
          </CButton>
          <CButton color="primary" style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CIcon icon={cilPlus} size="sm" />
            Nova OS
          </CButton>
        </div>
      </div>

      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16,
        }}
        className="pk-dashboard-grid"
      >
        <Card padding="0">
          <CardHeader
            title="Faturamento"
            desc="últimos 30 dias · serviços vs peças"
          />
          <div style={{ padding: '0 20px 20px', height: 260 }}>
            <RevenueChart />
          </div>
        </Card>

        <Card padding="0">
          <CardHeader title="OS por status" desc="distribuição atual" />
          <div style={{ padding: '0 20px 20px' }}>
            <StatusDonut />
          </div>
        </Card>
      </div>

      {/* ── Activity row ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
        className="pk-dashboard-grid"
      >
        {/* Próximos agendamentos */}
        <Card padding="0">
          <CardHeader
            title="Próximos agendamentos"
            desc="hoje e amanhã"
            action={
              <CButton color="primary" variant="ghost" size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Ver agenda <CIcon icon={cilArrowRight} size="sm" />
              </CButton>
            }
          />
          <div>
            {upcoming.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 20px',
                  borderTop: i === 0 ? 0 : '1px solid var(--cui-border-color)',
                }}
              >
                <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--cui-body-color)' }}>
                    {a.t}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>
                    {a.when}
                  </div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--cui-border-color)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--cui-body-color)' }}>{a.c}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--cui-secondary-color)',
                      display: 'flex',
                      gap: 6,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <span>{a.v}</span>
                    <span>·</span>
                    <span>{a.s}</span>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* OS recentes */}
        <Card padding="0">
          <CardHeader
            title="Ordens de serviço recentes"
            desc="últimas movimentações"
            action={
              <CButton color="primary" variant="ghost" size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Ver todas <CIcon icon={cilArrowRight} size="sm" />
              </CButton>
            }
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13.5 }}>
              <thead>
                <tr>
                  {['OS', 'Cliente', 'Total', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 2 ? 'right' : 'left',
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--cui-secondary-color)',
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--cui-border-color)',
                        background: 'var(--cui-card-cap-bg)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOS.map((o, i) => (
                  <tr key={o.n}>
                    <td
                      style={{
                        padding: '12px 16px',
                        borderBottom: i === recentOS.length - 1 ? 0 : '1px solid var(--cui-border-color)',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11.5,
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {o.n}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        borderBottom: i === recentOS.length - 1 ? 0 : '1px solid var(--cui-border-color)',
                      }}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{o.c}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', marginTop: 1 }}>{o.v}</div>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        borderBottom: i === recentOS.length - 1 ? 0 : '1px solid var(--cui-border-color)',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--cui-body-color)',
                      }}
                    >
                      {o.total}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        borderBottom: i === recentOS.length - 1 ? 0 : '1px solid var(--cui-border-color)',
                      }}
                    >
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
