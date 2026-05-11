# Landing Page Content Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atualizar conteúdo da landing page (`apps/frontend/src/pages/LandingPage.tsx`) para refletir o produto entregue hoje (oficina + recicladora live, sem clínicas no hero, sem PWA, sem multi-unidade universal, mockup alternando entre os dois segmentos), além de corrigir o preço do README.

**Architecture:** Edição direcionada de arquivo único (`LandingPage.tsx`) + correção de uma linha em `README.md`. Mantém estrutura de seções e CSS atuais. `HeroMockup` (já interno ao arquivo) ganha prop `variant` para alternar entre `workshop` e `recycling`. Componente pai gerencia state + timer de auto-swap. Sem novas dependências.

**Tech Stack:** React 19, TypeScript, CoreUI v5, Vitest, @testing-library/react.

**Spec:** [`docs/superpowers/specs/2026-05-04-landing-page-content-update-design.md`](../specs/2026-05-04-landing-page-content-update-design.md) (commit `1fad9d1`).

---

## Premissas para o engenheiro

- O monorepo usa `pnpm`. Comandos do frontend: `pnpm --filter frontend <script>`.
- O test runner é **Vitest** com `@testing-library/react` e `jsdom`. Padrão de teste existente está em [`apps/frontend/src/App.test.tsx`](../../../apps/frontend/src/App.test.tsx) e [`apps/frontend/src/components/PrivateRoute.test.tsx`](../../../apps/frontend/src/components/PrivateRoute.test.tsx). Use `import { render, screen } from '@testing-library/react'` e `import { describe, it, expect, vi, beforeEach } from 'vitest'`.
- Hoje **não existe** `LandingPage.test.tsx`. Vamos criá-lo na Task 1 e ir aumentando ao longo das tasks.
- A landing usa o componente `<Logo>` de [`apps/frontend/src/components/Logo.tsx`](../../../apps/frontend/src/components/Logo.tsx) — não mexer.
- A landing **não está dentro de `<MemoryRouter>` no production setup** (é renderizada por uma rota), mas para testes unitários **vamos renderizar `<LandingPage />` direto**, sem router. Os links `<a href="...">` resolvem como elementos DOM normais.
- TDD com asserts de DOM (`getByText`, `queryByText`, `getByRole`). Para textos que aparecem em múltiplos lugares, usar `getAllByText` ou seletores mais específicos.
- Commits frequentes — um commit por task. Padrão de mensagem do projeto: `tipo(escopo): descrição`. Use `feat(landing)`, `refactor(landing)`, `fix(landing)`, `docs(readme)` conforme apropriado.
- Não rodar `git push` até a última task (Quality Gate).

---

## Estrutura de arquivos afetados

| Arquivo | O que muda |
|---|---|
| [`apps/frontend/src/pages/LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx) | Hero (copy + selo), `HeroMockup` (variant prop), state+timer no `LandingPage`, features cards, pricing, FAQ. Tudo no mesmo arquivo (não vamos extrair `HeroMockup`). |
| `apps/frontend/src/pages/LandingPage.test.tsx` | **Novo arquivo** — testes da landing, criado na Task 1 e expandido ao longo do plano. |
| [`README.md`](../../../README.md) | Linha do "Modelo de negócio" (Task 9). |

Nenhum outro arquivo é tocado. Sem migrations, sem entities, sem services.

---

## Task 1: Setup — criar LandingPage.test.tsx com smoke test e remover selo "Novo · Relatórios v2" do hero

**Files:**
- Create: `apps/frontend/src/pages/LandingPage.test.tsx`
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (remover bloco do selo "Novo")

- [ ] **Step 1: Criar o arquivo de teste com asserção do estado atual + asserção da regra a ser implementada (selo "Novo" não pode existir)**

Arquivo `apps/frontend/src/pages/LandingPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renderiza sem crashar', () => {
    const { container } = render(<LandingPage />);
    expect(container.firstChild).not.toBeNull();
  });

  it('não exibe o selo "Novo · Relatórios v2"', () => {
    render(<LandingPage />);
    expect(screen.queryByText(/Relatórios v2/i)).toBeNull();
    expect(screen.queryByText(/^Novo$/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: o segundo teste falha com algo como *"expected null not to be ..."* — porque o DOM atual contém `<strong>Relatórios v2</strong>`. O primeiro teste passa.

- [ ] **Step 3: Remover o bloco do selo "Novo" em `LandingPage.tsx`**

No arquivo [`apps/frontend/src/pages/LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx), localizar (linhas ~209-220 do estado atual) e **deletar** o `<div>` da pílula:

```tsx
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px 4px 6px', border: '1px solid var(--cui-border-color)',
            background: 'var(--cui-card-bg)', borderRadius: 999, fontSize: 12.5,
            color: 'var(--cui-secondary-color)', marginBottom: isMobile ? 16 : 22,
            maxWidth: '100%',
          }}>
            <span style={{ background: 'rgba(52,142,145,0.12)', color: 'var(--cui-primary)', fontWeight: 600, padding: '2px 8px', borderRadius: 999, fontSize: 11, flexShrink: 0 }}>Novo</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--cui-body-color)' }}>Relatórios v2</strong> — ticket médio e funil
            </span>
          </div>
```

Após remover, o `<h1>` que vem depois passa a ser o primeiro filho do `<div>` à esquerda do hero.

- [ ] **Step 4: Rodar testes — devem passar**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 2/2 passam.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.test.tsx apps/frontend/src/pages/LandingPage.tsx
git commit -m "test(landing): smoke + remoção do selo \"Novo · Relatórios v2\""
```

---

## Task 2: HERO — ajustar copy do subtítulo (remover "clínicas")

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (texto do `<p>` do hero)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (novo teste)

- [ ] **Step 1: Adicionar teste no `LandingPage.test.tsx`**

Acrescentar dentro do `describe('LandingPage', ...)`:

```tsx
  it('subtítulo do hero menciona oficinas e recicladoras (sem clínicas)', () => {
    render(<LandingPage />);
    const subtitle = screen.getByText(/Plataforma feita para/i);
    expect(subtitle.textContent).toMatch(/oficinas e recicladoras/i);
    expect(subtitle.textContent).not.toMatch(/clínica/i);
  });
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: o novo teste falha — o texto atual diz "oficinas, clínicas e recicladoras".

- [ ] **Step 3: Substituir o texto do `<p>` no `LandingPage.tsx`**

Localizar o `<p>` do hero (logo após o `<h1>`) e substituir:

```tsx
          <p style={{
            fontSize: isMobile ? 15.5 : 17,
            lineHeight: 1.55, color: 'var(--cui-secondary-color)',
            maxWidth: 520, margin: '0 0 24px',
          }}>
            Plataforma feita para oficinas e recicladoras. Agenda, ordens de serviço, compras, vendas, estoque e relatórios — sem planilha, sem complicação.
          </p>
```

- [ ] **Step 4: Rodar testes — todos passam**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 3/3 passam.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/pages/LandingPage.test.tsx
git commit -m "feat(landing): subtítulo do hero remove \"clínicas\" e cita compras/vendas"
```

---

## Task 3: HeroMockup — refatorar para aceitar `variant: 'workshop' | 'recycling'`

Esta task **só refatora o componente** para aceitar a prop e mantém o comportamento atual (variante `workshop` igual ao mockup atual). A variante `recycling` entra na Task 4. O `LandingPage` continua passando a variante hardcoded `workshop`.

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (assinatura e corpo do `HeroMockup` + chamada no JSX do hero)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (novo teste)

- [ ] **Step 1: Adicionar teste que valida o mockup workshop renderiza itens conhecidos**

```tsx
  it('mockup do hero (workshop) mostra itens da oficina', () => {
    render(<LandingPage />);
    // "OS abertas" e "Ticket médio" são únicos do KPI de workshop;
    // "Agendamentos" colide (menu + KPI label) então usamos getAllByText.
    expect(screen.getByText('OS abertas')).toBeInTheDocument();
    expect(screen.getByText('Ticket médio')).toBeInTheDocument();
    expect(screen.getAllByText('Agendamentos').length).toBeGreaterThan(0);
    expect(screen.getByText('Veículos')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Rodar — deve passar (estado atual já satisfaz)**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 4/4 passam (esse teste documenta o comportamento atual antes do refator).

- [ ] **Step 3: Refatorar `HeroMockup` para aceitar `variant`**

Em [`LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx), substituir a função `HeroMockup` inteira por:

```tsx
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
    // Preenchido na Task 4
    menu: ['Dashboard', 'Agendamentos', 'OS', 'Clientes', 'Veículos'],
    kpis: [
      { label: 'OS abertas', value: '24' },
      { label: 'Faturamento', value: 'R$ 18.4k' },
      { label: 'Agendamentos', value: '47' },
      { label: 'Ticket médio', value: 'R$ 386' },
    ],
    chartLabel: '📈 Gráfico de faturamento',
    ariaLabel: 'Pré-visualização do painel',
  },
};

function HeroMockup({ compact, variant }: { compact: boolean; variant: HeroVariant }) {
  const content = HERO_CONTENT[variant];
  return (
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
```

- [ ] **Step 4: Atualizar a chamada do `HeroMockup` no JSX da `LandingPage`**

Localizar `<HeroMockup compact={isMobile} />` e substituir por:

```tsx
        <HeroMockup compact={isMobile} variant="workshop" />
```

- [ ] **Step 5: Rodar testes — todos continuam passando**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 4/4 passam (mockup workshop ainda mostra os mesmos itens).

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/pages/LandingPage.test.tsx
git commit -m "refactor(landing): HeroMockup aceita prop variant (workshop/recycling)"
```

---

## Task 4: HeroMockup — preencher conteúdo da variante `recycling`

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (entrada `recycling` em `HERO_CONTENT`)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (novo teste)

- [ ] **Step 1: Adicionar teste que renderiza `<LandingPage />` e força a variante `recycling` (via mock do timer ou via render do componente isolado)**

Para esta task, **vamos testar `HeroMockup` direto** (não via `LandingPage`), porque o auto-swap ainda não existe e o `LandingPage` sempre passa `workshop`. Adicionar no `LandingPage.test.tsx` (no fim do arquivo, fora do `describe` da landing):

```tsx
// HeroMockup é interno ao módulo. Para testá-lo em isolamento,
// re-exportamos via teste indireto: validamos o conteúdo recycling
// procurando textos exclusivos quando a variante recycling é montada.
// Como HeroMockup não é exportado, vamos cobrir essa variante na Task 5
// (auto-swap), onde o LandingPage passa a alternar variantes.
```

> **Observação para o engenheiro:** o componente `HeroMockup` é função interna do módulo, não exportada. Vamos confiar na cobertura via Task 5 (auto-swap) e no smoke visual da Task 10. Não exportar `HeroMockup` só para testá-lo isolado — preserva encapsulamento.

- [ ] **Step 2: Substituir a entrada `recycling` em `HERO_CONTENT` em `LandingPage.tsx`**

Localizar o objeto `recycling` dentro de `HERO_CONTENT` (criado na Task 3 com placeholder igual ao workshop) e substituir por:

```tsx
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
```

- [ ] **Step 3: Rodar testes — todos continuam passando**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 4/4 passam (a variante recycling ainda não é renderizada na landing).

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx
git commit -m "feat(landing): HeroMockup ganha conteúdo da variante recycling"
```

---

## Task 5: Hero auto-swap — state + timer + pause-on-hover

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (state no `LandingPage`, wrapper com handlers e CSS de fade)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (testes com `vi.useFakeTimers()`)

- [ ] **Step 1: Adicionar testes que usam timers fake do Vitest**

Adicionar no `LandingPage.test.tsx`, **dentro do `describe('LandingPage', ...)`** principal:

```tsx
  it('mockup alterna automaticamente para a variante recycling após ~5s', async () => {
    vi.useFakeTimers();
    render(<LandingPage />);
    // Antes do swap: KPIs de workshop, sem KPIs de recycling.
    expect(screen.getByText('OS abertas')).toBeInTheDocument();
    expect(screen.queryByText('Compras hoje')).toBeNull();

    await vi.advanceTimersByTimeAsync(5000);

    // Depois do swap: KPIs de recycling, sem KPIs de workshop.
    expect(screen.queryByText('OS abertas')).toBeNull();
    expect(screen.getByText('Compras hoje')).toBeInTheDocument();

    vi.useRealTimers();
  });
```

E também precisa do `vi` import — atualizar a primeira linha do `LandingPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
```

- [ ] **Step 2: Rodar — o novo teste deve falhar**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: o teste de auto-swap falha — o `LandingPage` ainda passa `variant="workshop"` fixo.

- [ ] **Step 3: Adicionar state, ref de pause, e effect com `setInterval` no `LandingPage`**

Em [`LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx), localizar a função `LandingPage()` e adicionar (logo após `const [faqOpen, setFaqOpen] = useState<number>(-1);` e `const isMobile = useIsMobile();`):

```tsx
  const [heroVariant, setHeroVariant] = useState<HeroVariant>('workshop');
  const heroPausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (heroPausedRef.current) return;
      setHeroVariant(v => (v === 'workshop' ? 'recycling' : 'workshop'));
    }, 5000);
    return () => window.clearInterval(id);
  }, []);
```

Atualizar o import do React no topo do arquivo para incluir `useRef`:

```tsx
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 4: Envolver `<HeroMockup>` num wrapper que reage a hover, e usar `heroVariant` como prop**

Substituir `<HeroMockup compact={isMobile} variant="workshop" />` por:

```tsx
        <div
          onMouseEnter={() => { heroPausedRef.current = true; }}
          onMouseLeave={() => { heroPausedRef.current = false; }}
          style={{ transition: 'opacity 0.4s ease' }}
        >
          <HeroMockup compact={isMobile} variant={heroVariant} />
        </div>
```

> **Sobre o fade:** o spec menciona transição opacity. Como o componente é remontado com props diferentes (não há cross-fade real entre dois mockups simultâneos), o `transition` no wrapper aplica no re-render visualmente suave. Para uma transição mais elegante (cross-fade real), seria preciso renderizar ambos sobrepostos com opacidades opostas — mas isso dobra DOM, não está no spec, e fica fora de escopo. O `transition: 0.4s` no wrapper basta.

- [ ] **Step 5: Rodar testes — todos passam**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 5/5 passam.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/pages/LandingPage.test.tsx
git commit -m "feat(landing): hero alterna mockup workshop/recycling a cada 5s (pausa no hover)"
```

---

## Task 6: FEATURES — ajustar copy, substituir card 6 e adicionar 7º card "WhatsApp em breve"

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (constante `features`, subtítulo da seção, JSX do card com selo)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (testes da seção features)

- [ ] **Step 1: Adicionar testes**

Adicionar no `LandingPage.test.tsx`:

```tsx
  it('seção features não menciona Multi-unidade nem "com sua marca"', () => {
    render(<LandingPage />);
    expect(screen.queryByText(/Multi-unidade/i)).toBeNull();
    expect(screen.queryByText(/com sua marca/i)).toBeNull();
  });

  it('seção features inclui Cobrança automática (Asaas)', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Cobrança automática/i)).toBeInTheDocument();
    // "Asaas" aparece também no FAQ e no rodapé do pricing — usar getAllByText.
    expect(screen.getAllByText(/Asaas/i).length).toBeGreaterThanOrEqual(1);
  });

  it('seção features inclui WhatsApp integrado com selo "Em breve"', () => {
    render(<LandingPage />);
    const card = screen.getByText(/WhatsApp integrado/i).closest('div');
    expect(card).not.toBeNull();
    // O selo "Em breve" aparece dentro do card; usamos getAllByText pois "Em breve"
    // também aparece nos cards de segmento (Médica/Odonto).
    const seloMatches = screen.getAllByText(/^Em breve$/i);
    expect(seloMatches.length).toBeGreaterThanOrEqual(3); // 2 segmentos + 1 feature
  });

  it('subtítulo da seção features diz "sete superpoderes"', () => {
    render(<LandingPage />);
    expect(screen.getByText(/sete superpoderes/i)).toBeInTheDocument();
    expect(screen.queryByText(/seis superpoderes/i)).toBeNull();
  });
```

- [ ] **Step 2: Rodar — devem falhar**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 4 novos testes falham.

- [ ] **Step 3: Atualizar constante `features` em `LandingPage.tsx`**

Substituir o array `features` (linhas ~36-43 do estado atual) por:

```tsx
const features: { emoji: string; title: string; desc: string; soon?: boolean }[] = [
  { emoji: '⚡', title: 'Configure em minutos', desc: 'Onboarding guiado por segmento. Seus primeiros agendamentos e OS em menos de 10 min.' },
  { emoji: '🔒', title: 'Dados seguros e exportáveis', desc: 'Backups diários, LGPD-friendly. Seus dados são seus — exporte em CSV ou PDF quando quiser.' },
  { emoji: '✨', title: 'Feito no Brasil', desc: 'Suporte em português, adaptado à realidade de pequenos e médios negócios brasileiros.' },
  { emoji: '📊', title: 'Relatórios que importam', desc: 'Faturamento, ticket médio, top serviços. Decisões baseadas em dados, não em intuição.' },
  { emoji: '🖨️', title: 'PDF profissional', desc: 'Ordens de serviço, orçamentos e tabelas de preço prontos para imprimir ou enviar.' },
  { emoji: '💳', title: 'Cobrança automática', desc: 'PIX, cartão e recorrência via Asaas. Inadimplência tratada automaticamente — você não precisa lembrar.' },
  { emoji: '💬', title: 'WhatsApp integrado', desc: 'Atendimento e notificações pelo número da sua empresa, direto do Praktikus.', soon: true },
];
```

- [ ] **Step 4: Atualizar subtítulo da seção features**

Localizar o `<p>` da seção features (logo após o `<h2>` "Tudo o que você precisa, *nada que você não*"):

```tsx
          <p style={{ color: 'var(--cui-secondary-color)', margin: 0, fontSize: isMobile ? 14 : 15 }}>
            Um único sistema, sete superpoderes.
          </p>
```

- [ ] **Step 5: Atualizar o JSX do `.map(features)` para renderizar selo "Em breve" quando `soon === true`**

Localizar o bloco `{features.map(f => (...))}` na seção features e substituir por:

```tsx
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
```

- [ ] **Step 6: Rodar testes — todos passam**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 9/9 passam.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/pages/LandingPage.test.tsx
git commit -m "feat(landing): features 6→7 cards, troca Multi-unidade por Cobrança, +WhatsApp em breve"
```

---

## Task 7: PRICING — refator do `plan` const + layout em duas colunas

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (`plan` const + JSX do card de pricing)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (testes do pricing)

- [ ] **Step 1: Adicionar testes**

```tsx
  it('pricing: card mostra R$ 89,90 e três listas (universal + oficinas + recicladoras)', () => {
    render(<LandingPage />);
    expect(screen.getByText(/R\$ 89,90/)).toBeInTheDocument();
    expect(screen.getByText(/^Para oficinas$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Para recicladoras$/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadastros e movimentações ilimitados/i)).toBeInTheDocument();
    expect(screen.getByText(/Múltiplas tabelas de preço/i)).toBeInTheDocument();
    expect(screen.getByText(/Coletas agendadas/i)).toBeInTheDocument();
  });

  it('pricing: card NÃO menciona "5 usuários", "Multi-unidade", "com sua marca", nem "prioritário"', () => {
    render(<LandingPage />);
    expect(screen.queryByText(/5 usuários/i)).toBeNull();
    expect(screen.queryByText(/Multi-unidade/i)).toBeNull();
    expect(screen.queryByText(/com sua marca/i)).toBeNull();
    expect(screen.queryByText(/Suporte prioritário/i)).toBeNull();
  });
```

- [ ] **Step 2: Rodar — devem falhar**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 2 novos testes falham.

- [ ] **Step 3: Substituir o `const plan` em `LandingPage.tsx`**

```tsx
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
```

- [ ] **Step 4: Substituir o JSX do card de pricing**

Localizar o bloco `<ul style={{ listStyle: 'none', padding: 0, margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>` (atual lista única dentro do card) e substituir por:

```tsx
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
```

- [ ] **Step 5: Rodar testes — todos passam**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 11/11 passam.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/pages/LandingPage.test.tsx
git commit -m "feat(landing): pricing card em 2 colunas (Para oficinas / Para recicladoras)"
```

---

## Task 8: FAQ — reescrever pergunta "Preciso instalar algo?"

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx` (constante `faqs`)
- Modify: `apps/frontend/src/pages/LandingPage.test.tsx` (teste do FAQ)

- [ ] **Step 1: Adicionar teste**

```tsx
  it('FAQ "Preciso instalar algo?" não menciona PWA nem offline', () => {
    render(<LandingPage />);
    // Abre o accordion clicando na pergunta
    const question = screen.getByText(/Preciso instalar algo\?/i);
    question.click();
    // Após abrir, a resposta visível não pode citar PWA/offline
    const faqSection = question.closest('section');
    expect(faqSection).not.toBeNull();
    expect(faqSection!.textContent).not.toMatch(/PWA/i);
    expect(faqSection!.textContent).not.toMatch(/offline/i);
  });
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: o novo teste falha (texto atual menciona "PWA instalável" e "offline").

- [ ] **Step 3: Atualizar a 5ª entrada do array `faqs` em `LandingPage.tsx`**

Substituir apenas o último item do array `faqs`:

```tsx
  { q: 'Preciso instalar algo?', a: 'Não. Praktikus roda 100% no navegador, em qualquer dispositivo — basta acessar app.praktikus.com.br. Layout responsivo para celular e tablet.' },
```

- [ ] **Step 4: Rodar testes — todos passam**

Run: `pnpm --filter frontend test -- LandingPage.test`

Expected: 12/12 passam.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/pages/LandingPage.test.tsx
git commit -m "fix(landing): FAQ remove promessa de PWA (não implementado)"
```

---

## Task 9: README — corrigir preço para R$ 89,90 e remover "reajuste anual"

**Files:**
- Modify: `README.md` (uma linha)

- [ ] **Step 1: Localizar a linha do "Modelo de negócio"**

Em [`README.md`](../../../README.md), perto da linha 6, está:

```markdown
**Modelo de negócio:** 30 dias de trial gratuito + R$69,90/mês, com reajuste anual configurável.
```

- [ ] **Step 2: Substituir pela linha correta**

```markdown
**Modelo de negócio:** 30 dias de trial gratuito + R$ 89,90/mês.
```

- [ ] **Step 3: Verificar com `git diff`**

Run: `git diff README.md`

Expected: apenas essa linha mudou.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): preço correto R$ 89,90/mês e remoção de reajuste anual (não implementado)"
```

---

## Task 10: Smoke visual + lint + build — verificação local antes do gate

**Files:** N/A — validação.

- [ ] **Step 1: Lint do frontend**

Run: `pnpm --filter frontend lint`

Expected: 0 erros, 0 warnings novos. Se houver `react-hooks/exhaustive-deps` warning no `useEffect` da Task 5, o array de dependências `[]` é correto (o efeito só precisa configurar uma vez); se o linter reclamar, suprimir com `// eslint-disable-next-line react-hooks/exhaustive-deps` na linha imediatamente acima do array de deps.

- [ ] **Step 2: Type check**

Run: `pnpm --filter frontend exec tsc --noEmit`

Expected: 0 erros.

- [ ] **Step 3: Suite completa de testes do frontend**

Run: `pnpm --filter frontend test`

Expected: 100% verde, sem testes pulados que não estavam pulados antes.

- [ ] **Step 4: Build de produção**

Run: `pnpm --filter frontend build`

Expected: build conclui sem erros.

- [ ] **Step 5: Smoke visual manual**

Subir o dev server: `pnpm --filter frontend dev`

Em `http://localhost:5173/` (ou porta que o Vite reportar), verificar:

- ✅ Hero não tem mais o selo "Novo · Relatórios v2".
- ✅ Subtítulo do hero diz "oficinas e recicladoras" (sem "clínicas").
- ✅ Mockup do hero alterna entre tela de oficina (Agendamentos/OS/Veículos/Ticket médio) e tela de recicladora (Compras/Vendas/Caixa/Estoque/Compras hoje) a cada 5s.
- ✅ Mouse sobre o mockup pausa o swap; mouse fora retoma.
- ✅ Seção de features tem 7 cards. Card "Multi-unidade" não existe. Existe "Cobrança automática" (cartão 6) e "WhatsApp integrado" com selo "Em breve" (cartão 7).
- ✅ Subtítulo da seção features diz "sete superpoderes".
- ✅ Card de pricing mostra R$ 89,90, lista universal + duas colunas "Para oficinas" / "Para recicladoras".
- ✅ Em viewport mobile (DevTools, 375px de largura), as duas colunas do pricing colapsam em uma só (empilham).
- ✅ FAQ "Preciso instalar algo?" abre e mostra resposta sem mencionar PWA ou offline.
- ✅ Nada visualmente quebrado: fontes carregam, ícones aparecem, espaçamentos preservados.

Se algo está visualmente quebrado, **voltar e corrigir** — não seguir para o Quality Gate.

- [ ] **Step 6: Commit (caso tenha sido necessário ajustar algo no smoke)**

Se ajustes foram feitos:

```bash
git add apps/frontend/src/pages/LandingPage.tsx
git commit -m "fix(landing): ajustes do smoke visual"
```

Se nada precisou mudar, pular este step.

---

## Task 11: Quality Gate (Sonar) — obrigatória, sempre última

**Files:** N/A — esta task valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`
Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`. Se demorar, aguardar até 60s.

- [ ] **Step 2: Rodar coverage + scanner + aguardar gate**

Run: `pnpm sonar:check`
Expected: gate verde com mensagem `✅ Quality gate verde.`

- [ ] **Step 3: Se gate falhou, listar issues new-code**

Run: `curl -s -u "$SONAR_TOKEN:" "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true&ps=500" | jq '.issues[] | {key, rule, severity, message, component, line}'`

- [ ] **Step 4: Para cada issue, corrigir ou suprimir com justificativa**

- **Bug/vuln/duplicação real:** corrigir o código.
- **Falso positivo legítimo:** suprimir inline com `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 5: Push autorizado**

Run: `git push`
Expected: pre-push hook valida silenciosamente e libera.

---

## Self-review do plano

✅ **Cobertura do spec:**
- Hero copy + remoção do selo → Tasks 1, 2.
- HeroMockup com variantes + auto-swap → Tasks 3, 4, 5.
- Segmentos (sem mudança) → confirmado, sem task.
- Features (PDF copy, troca de Multi-unidade, +WhatsApp em breve, subtítulo 6→7) → Task 6.
- Pricing (refator `plan` + duas colunas + mobile collapse) → Task 7.
- FAQ → Task 8.
- README → Task 9.
- Smoke + lint + build → Task 10.
- Quality Gate → Task 11.

✅ **Sem placeholders.** Cada step tem código completo ou comando exato.

✅ **Consistência de tipos:** `HeroVariant`, `HeroMockupContent`, `HERO_CONTENT`, `heroVariant`, `heroPausedRef` — usados de forma consistente entre Tasks 3, 4 e 5. `plan.universal`/`plan.workshop`/`plan.recycling` usados consistentemente em Task 7.

✅ **Escopo:** focado em um arquivo de feature + README. Não há tarefas inflando o plano.
