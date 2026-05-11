# Design — Atualização de conteúdo da Landing Page

**Data:** 2026-05-04
**Branch base:** `redesign/praktikus-v2`
**Escopo:** correção pontual de conteúdo em [`apps/frontend/src/pages/LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx) para alinhar a landing à realidade do produto entregue hoje. Estrutura visual, layout e arquitetura **ficam como estão** — mesmas seções, mesmo CSS, mesmos componentes. A única mudança estrutural é o `HeroMockup` ganhar uma variante para o segmento Recycling.

---

## Contexto e motivação

A landing pública vende um produto que diverge do que o Praktikus entrega hoje. Diagnóstico das principais divergências:

1. **Hero copy** menciona *"oficinas, clínicas e recicladoras"* — clínicas ainda não existem (enum [`TenantSegment`](../../../packages/shared/src/enums/tenant-segment.enum.ts) só tem `WORKSHOP` e `RECYCLING`).
2. **Hero mockup** mostra exclusivamente a oficina (Agendamentos, OS, Clientes, Veículos). Recycling tem domínio bem distinto (compras, vendas, caixa, estoque, fornecedores, compradores, tabelas de preço, coletas, unidades) e fica invisível na vitrine.
3. **Selo "Novo · Relatórios v2 — ticket médio e funil"** no hero não corresponde a entrega real em `docs/`.
4. **Plano "Pro"** lista features só de oficina (*"OS e agendamentos ilimitados"*), promete *"Até 5 usuários inclusos"* (sem enforcement técnico) e *"Multi-unidade"* (só Recycling tem módulo `units`) e *"PDF com sua marca"* (não há customização de marca em PDFs hoje).
5. **Card "Multi-unidade"** nas features universais é meia-promessa — só Recycling tem.
6. **FAQ "Preciso instalar algo?"** promete *"app PWA instalável no celular para usar offline"* — não há `manifest.json`, service worker, nem qualquer config de PWA em [`apps/frontend/`](../../../apps/frontend/).
7. **Recycling como produto live** está sub-representado — não aparece no mockup, não aparece nos benefícios, não aparece nas features específicas.

Esta entrega corrige as divergências sem expandir escopo (sem redesign visual, sem landings dedicadas por segmento, sem i18n).

## Decisões alinhadas com o usuário

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo da atualização | **A — correção pontual** mantendo estrutura atual (hero, segmentos, features, pricing, FAQ). |
| 2 | Preço do plano Pro (landing R$ 89,90 vs. README R$ 69,90) | **R$ 89,90/mês está correto.** README é que está desatualizado e será corrigido. |
| 3 | Conjunto de segmentos "em breve" | **A — manter os 4 atuais** (Oficina ✅, Recicladora ✅, Clínica Médica 🔜, Odontologia 🔜). Sem barbearia. |
| 4 | Hero copy + mockup | **B — copy "oficinas e recicladoras" e mockup alterna entre os dois segmentos** (auto-swap a cada 5s, pausa no hover). |
| 5 | Estrutura da lista de features do plano | **B — duas colunas dentro do mesmo card** (universal no topo, "Para oficinas" / "Para recicladoras" abaixo). Mostra que o mesmo plano cobre dois domínios distintos. |
| 6 | Selo "Novo" no hero | **D — remover.** Selo exige manutenção contínua e a landing não tem owner de marketing dedicado. |
| 7 | Substituto do card "Multi-unidade" nas features | **C — "Cobrança automática via PIX, cartão e recorrência (Asaas)".** Recurso real, vendável para PME brasileiro. |
| 8 | WhatsApp na landing (módulo existe mas em fase 1) | **C com selo "Em breve"** — adicionar como **7º card** (não substitui ninguém), com badge claramente sinalizando roadmap. |
| 9 | FAQ "Preciso instalar algo?" | **A — reescrever para a verdade**, sem prometer PWA. |

## Fora de escopo (explícito)

- Mudanças em CSS global, theme tokens, fonts ou layout principal.
- Landings dedicadas por segmento (`/oficina`, `/recicladora`).
- Internacionalização (i18n) de qualquer texto.
- Tracking, analytics ou A/B testing.
- Implementação de PWA real (service worker, manifest).
- Implementação de "PDF com a sua marca" (customização de branding em PDF).
- Implementação de multi-unidade no Workshop.
- Mudanças no fluxo de cadastro / login / billing.
- Conteúdo "Termos", "Privacidade", "Status" do footer (mantidos como `href="#"` placeholders).

---

## 1. NAV
Sem mudança.

## 2. HERO

### 2.1 Copy
- **Selo "Novo · Relatórios v2 — ticket médio e funil"**: ❌ remover por completo (a `<div>` que envolve a pílula).
- **Subtítulo do hero** (`<p>`): trocar
  - **De:** *"Plataforma feita para oficinas, clínicas e recicladoras. Agenda, ordens de serviço, clientes, estoque e relatórios — sem planilha, sem complicação."*
  - **Para:** *"Plataforma feita para oficinas e recicladoras. Agenda, ordens de serviço, compras, vendas, estoque e relatórios — sem planilha, sem complicação."*
- **`<h1>`** mantém o atual (*"Gestão **inteligente** para o seu negócio de serviços."*).
- **CTAs e badges de checkmarks** (30 dias grátis · cancele · suporte em PT) mantêm.

### 2.2 Mockup com variantes

`HeroMockup` passa a aceitar prop `variant: 'workshop' | 'recycling'`.

**Variante `workshop`** (atual, mantida):
- Menu lateral: Dashboard, Agendamentos, OS, Clientes, Veículos
- Saudação: *"Bom dia, Vini 👋"*
- KPIs: OS abertas (24), Faturamento (R$ 18.4k), Agendamentos (47), Ticket médio (R$ 386)
- Gráfico: *"📈 Gráfico de faturamento"*

**Variante `recycling`** (nova):
- Menu lateral: Dashboard, Compras, Vendas, Caixa, Estoque
- Saudação: *"Bom dia, Vini 👋"* (igual)
- KPIs: Compras hoje (R$ 4.2k), Faturamento (R$ 22.7k), Caixa (R$ 1.840), Estoque (8.4t)
- Gráfico: *"📈 Compras por material"*

**URL fake do browser**: continua `app.praktikus.com.br/dashboard` (neutro, serve às duas variantes).

**Comportamento de auto-swap**:
- Componente pai (`LandingPage`) tem state `heroVariant: 'workshop' | 'recycling'`.
- `useEffect` com `setInterval(5000)` alterna entre os dois.
- Pausa quando mouse entra no mockup (`onMouseEnter`) e retoma quando sai (`onMouseLeave`).
- Mobile: o auto-swap continua funcionando (não há hover, então roda sem pausa).
- Transição visual: `opacity` + `transition: 0.4s ease` ao trocar (sem libs novas — CSS puro).

**Acessibilidade**:
- Wrapper do mockup ganha `role="img"` e `aria-label` que reflete a variante atual (*"Pré-visualização do painel para oficinas"* / *"Pré-visualização do painel para recicladoras"*).
- Sem prejuízo a screen-readers — o conteúdo do hero (h1, p, CTAs) é o que importa para SEO/leitura.

## 3. SEGMENTOS

Sem mudança no código. **4 cards mantidos** com os textos atuais:

| Emoji | Nome | Descrição | Status |
|---|---|---|---|
| 🔧 | Oficina Mecânica | Gestão completa de OS, agendamentos, peças e clientes para oficinas de todo porte. | ✅ live |
| ♻️ | Recicladoras | Controle de compras, estoque, caixa e vendas para cooperativas e recicladoras. | ✅ live |
| 🏥 | Clínica Médica | Prontuários, agendamentos e gestão completa de pacientes e convênios. | 🔜 em breve |
| 🦷 | Odontologia | Gestão de consultas, orçamentos e histórico odontológico detalhado. | 🔜 em breve |

## 4. FEATURES (cards genéricos)

**De 6 para 7 cards.** Mudanças:

| # | Antes | Depois |
|---|---|---|
| 1 | ⚡ **Configure em minutos** — Onboarding guiado por segmento. Seus primeiros agendamentos e OS em menos de 10 min. | (mantém) |
| 2 | 🔒 **Dados seguros e exportáveis** — Backups diários, LGPD-friendly. Seus dados são seus — exporte em CSV ou PDF quando quiser. | (mantém) |
| 3 | ✨ **Feito no Brasil** — Suporte em português, adaptado à realidade de pequenos e médios negócios brasileiros. | (mantém) |
| 4 | 📊 **Relatórios que importam** — Faturamento, ticket médio, top serviços. Decisões baseadas em dados, não em intuição. | (mantém) |
| 5 | 🖨️ **PDF profissional** — Ordens de serviço e orçamentos prontos para imprimir ou enviar, **com sua marca**. | 🖨️ **PDF profissional** — *"Ordens de serviço, orçamentos e tabelas de preço prontos para imprimir ou enviar."* (remove "com sua marca") |
| 6 | 🏢 **Multi-unidade** — Gerencie várias filiais com permissões granulares e relatórios consolidados. | 💳 **Cobrança automática** — *"PIX, cartão e recorrência via Asaas. Inadimplência tratada automaticamente — você não precisa lembrar."* |
| 7 | (não existia) | 💬 **WhatsApp integrado** — *"Atendimento e notificações pelo número da sua empresa, direto do Praktikus."* — **com selo "Em breve" no canto superior direito do card** |

**Selo "Em breve" do card 7**:
- Mesmo estilo visual já usado nos cards de segmento "em breve" (pílula cinza com borda).
- Texto: *"Em breve"*.
- Posicionada absolutamente no canto superior direito do card.
- Card mantém clicável/hoverable, mas sem ação de navegação (já não tem hoje nos cards de feature).

**Subtítulo da seção**:
- **De:** *"Um único sistema, seis superpoderes."*
- **Para:** *"Um único sistema, sete superpoderes."*

## 5. PRICING (card único — R$ 89,90)

### 5.1 Estrutura nova (duas colunas dentro do card)

```
[selo: PLANO ÚNICO]

PRAKTIKUS PRO
R$ 89,90 /mês
Acesso completo, sem limites, sem surpresas.

✓ Cadastros e movimentações ilimitados
✓ Relatórios mensais e exportação em PDF/CSV
✓ Suporte em português

──────────────────  ──────────────────
PARA OFICINAS       PARA RECICLADORAS
──────────────────  ──────────────────
• Agenda, OS e      • Compras, vendas
  prontuário          e caixa
• Clientes e        • Estoque por
  veículos com        material
  histórico         • Múltiplas tabelas
• Catálogo de         de preço
  serviços e peças  • Coletas
                      agendadas

[Começar 30 dias grátis →]

Cobrança segura via Asaas · Cancele quando quiser
```

### 5.2 Implementação

A constante `plan` em [`LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx) muda de `features: string[]` para:

```ts
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

JSX renderiza:
1. Lista `universal` no topo (mesmo estilo de checkmark já usado).
2. Abaixo, um grid 2 colunas (`gridTemplateColumns: '1fr 1fr'`) com sub-listas, cada uma com seu cabeçalho (*"Para oficinas"* / *"Para recicladoras"*).
3. **No mobile** (`isMobile`), o grid colapsa para 1 coluna (sub-listas empilhadas).

Cabeçalhos das sub-listas usam o mesmo `text-transform: uppercase` + `letter-spacing` + `color: secondary` do label "Praktikus Pro" atual.

**Removidos** (sem substituto):
- *"Até 5 usuários inclusos"* — sem enforcement técnico no auth/billing.
- *"Multi-unidade"* — só Recycling tem `units`.
- *"PDF com sua marca"* — vira *"exportação em PDF/CSV"* (mais honesto).
- *"Suporte prioritário em português"* — vira *"Suporte em português"* (sem "prioritário", que sugere planos diferenciados que não existem).

## 6. FAQ

**4 perguntas mantidas sem mudança** (trial 30 dias, cobrança/Asaas R$ 89,90, cancelamento, segurança/LGPD).

**5ª pergunta reescrita:**

| | Texto |
|---|---|
| **Antes (Q)** | *"Preciso instalar algo?"* |
| **Antes (A)** | *"Não. Praktikus roda 100% no navegador — também temos app PWA instalável no celular para usar offline em casos pontuais."* |
| **Depois (Q)** | *"Preciso instalar algo?"* (mantém) |
| **Depois (A)** | *"Não. Praktikus roda 100% no navegador, em qualquer dispositivo — basta acessar `app.praktikus.com.br`. Layout responsivo para celular e tablet."* |

## 7. FOOTER
Sem mudança.

---

## Trabalhos correlatos (mesmo PR)

### README.md — corrigir preço

[`README.md:6`](../../../README.md) hoje afirma:

> *"**Modelo de negócio:** 30 dias de trial gratuito + R$69,90/mês, com reajuste anual configurável."*

Preço real é **R$ 89,90/mês**. Substituir o número e remover *"com reajuste anual configurável"* (não há mecanismo de reajuste anual implementado — sem `priceTable.adjustmentRule`, sem cron, sem nada). Texto novo:

> *"**Modelo de negócio:** 30 dias de trial gratuito + R$ 89,90/mês."*

Esta é uma mudança de uma linha. Vai no mesmo PR pois compartilha a motivação ("alinhar artefatos públicos à realidade").

---

## Critérios de aceitação

1. ✅ [`LandingPage.tsx`](../../../apps/frontend/src/pages/LandingPage.tsx) passa lint, type-check e Sonar quality gate (cobertura mantida — não há lógica nova relevante além do swap de variante).
2. ✅ Hero copy não menciona "clínicas".
3. ✅ Selo "Novo · Relatórios v2" não aparece em lugar nenhum do DOM da landing.
4. ✅ Mockup do hero alterna automaticamente entre `workshop` e `recycling` a cada 5 segundos.
5. ✅ Hover no mockup pausa o auto-swap; mouse-leave retoma.
6. ✅ Card "Multi-unidade" não existe; existe card "Cobrança automática (PIX/cartão/Asaas)".
7. ✅ Card "WhatsApp integrado" existe com selo "Em breve" visível no canto.
8. ✅ Subtítulo da seção features diz "sete superpoderes".
9. ✅ Plan card mostra lista universal + duas colunas (oficinas/recicladoras), e colapsa para coluna única no mobile.
10. ✅ Plan card não menciona "5 usuários", "multi-unidade", "PDF com sua marca", nem "suporte prioritário".
11. ✅ FAQ "Preciso instalar algo?" não menciona PWA.
12. ✅ README.md afirma R$ 89,90/mês e remove "reajuste anual configurável".
13. ✅ Smoke visual em mobile e desktop: nada quebrou nem cortou texto.
14. ✅ Teste novo (ou ampliação de teste existente) cobrindo: render do `recycling` variant do `HeroMockup`, render do 7º card com badge "Em breve", render das duas sub-listas no plan card.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Auto-swap do mockup distrai usuário lendo o `<h1>`/CTA. | 5s é tempo suficiente para ler. Hover pausa. Se for problema em uso real, vira issue posterior — não bloqueia esta entrega. |
| Card "WhatsApp em breve" é interpretado como entregue. | Selo visual idêntico ao usado nos segmentos "em breve" (já validado). Texto do badge é literal "Em breve". |
| Plan card com duas colunas vira muito longo no mobile. | Mobile colapsa pra 1 coluna empilhada — testar manualmente em viewport 375px. |
| Conteúdo da landing fica desatualizado de novo daqui 2 meses. | Fora de escopo desta entrega resolver isso de forma sistêmica. Próxima evolução pode ser mover textos pra `packages/shared/landing-content.ts` para virar fonte única, ou puxar de feature flags. |

---

## Próximos passos (após aprovação)

Invocar `superpowers:writing-plans` para gerar o plano de implementação detalhado, com tasks atômicas e a task obrigatória **"Quality Gate (Sonar)"** ao final, conforme [CLAUDE.md](../../../CLAUDE.md).
