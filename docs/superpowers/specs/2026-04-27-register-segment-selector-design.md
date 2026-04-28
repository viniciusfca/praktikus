# Tela seletora de segmento no cadastro

**Data:** 2026-04-27
**Branch:** redesign/praktikus-v2 (ou nova branch)
**Escopo:** apenas frontend (rotas + 1 página nova + ajuste de links)

---

## Contexto

Hoje a aplicação tem duas páginas de cadastro praticamente idênticas:

- `apps/frontend/src/pages/auth/RegisterPage.tsx` (oficina) — montada em `/register`
- `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx` (recicladora) — montada em `/register/recycling`

A diferença entre elas é mínima: STEPS labels, rota final pós-cadastro, placeholders e um checkbox de termos a mais na oficina.

A landing tem uma seção "Escolha seu segmento" com cards que pulam diretamente para a rota correspondente (`/register` ou `/register/recycling`). Esse caminho funciona bem.

O problema é o **fluxo a partir do login** (e qualquer outro CTA "Comece grátis" que não passe pela landing): "Comece grátis" aponta para `/register`, que abre direto o cadastro de oficina, sem dar chance ao usuário de escolher o segmento.

## Objetivo

Inserir uma tela seletora de segmento entre o CTA "Comece grátis" e os formulários de cadastro existentes — **sem mexer no conteúdo dos forms atuais**, apenas reorganizando rotas e adicionando uma página leve de roteamento.

## Decisão de design (validada no brainstorming)

- **Manter os dois forms intocados** (`RegisterPage.tsx` e `RegisterRecyclingPage.tsx`).
- **Inserir uma tela seletora** que reusa `<AuthShell>` e mostra cards parecidos com a seção "Escolha seu segmento" da landing.
- **Reorganizar rotas** para que `/register` seja o seletor; o cadastro de oficina ganha rota explícita `/register/workshop`.
- **Cards "Em breve"** (Clínica, Odontologia) aparecem desabilitados na seletora — paridade visual com a landing.
- **Sem testes específicos** — página é só navegação. Smoke manual após implementação.

## Arquitetura

### Mudança de rotas em `apps/frontend/src/App.tsx`

| Rota | Antes | Depois |
|---|---|---|
| `/register` | `<RegisterPage />` (oficina) | `<RegisterSegmentPage />` (nova seletora) |
| `/register/workshop` | (não existe) | `<RegisterPage />` |
| `/register/recycling` | `<RegisterRecyclingPage />` | (sem mudança) |

### Nova página

`apps/frontend/src/pages/auth/RegisterSegmentPage.tsx`:

- Reusa `<AuthShell>`.
- Estrutura:
  - Título h1: *"Vamos começar"*
  - Subtítulo p: *"Selecione o segmento da sua empresa para configurar seu cadastro."*
  - Grid responsivo (2 col desktop, 1 col mobile via `pk-form-row-2` ou inline media):
    - Card **Oficina Mecânica** (🔧, descrição curta, link `/register/workshop`)
    - Card **Recicladoras** (♻️, descrição curta, link `/register/recycling`)
  - Grid secundário com cards "Em breve" desabilitados:
    - **Clínica Médica** (🏥)
    - **Odontologia** (🦷)
  - Rodapé: link "Já tem conta? Entrar" → `/login`
- Estilo dos cards alinhado com `LandingPage.tsx` (mesmo padrão visual da seção segmentos lá).

Conteúdo dos cards (igual à landing):

```typescript
const segments = [
  { emoji: '🔧', name: 'Oficina Mecânica', desc: 'OS, agendamentos, peças e clientes.', live: true, path: '/register/workshop' },
  { emoji: '♻️', name: 'Recicladoras', desc: 'Compras, estoque, caixa e vendas.', live: true, path: '/register/recycling' },
  { emoji: '🏥', name: 'Clínica Médica', desc: 'Em breve.', live: false },
  { emoji: '🦷', name: 'Odontologia', desc: 'Em breve.', live: false },
];
```

Live cards são clicáveis via `useNavigate()` em `onClick` do container do card (mesmo padrão da `LandingPage.tsx` na seção de segmentos). Cards live ficam destacados com hover (borda primary + leve elevação); "em breve" ficam atenuados (`opacity: 0.6`, `cursor: not-allowed`, `aria-disabled="true"`) e sem ação ao clicar.

### Atualização de links que apontam para `/register`

| Arquivo | Local | Ação |
|---|---|---|
| `apps/frontend/src/pages/auth/LoginPage.tsx` | Link "Comece grátis" no rodapé do form | mantém `to="/register"` (agora vai pra seletora — comportamento muda automaticamente) |
| `apps/frontend/src/pages/LandingPage.tsx` | Card de segmento "Oficina Mecânica" no array `segments` | trocar `path: '/register'` por `path: '/register/workshop'` |
| `apps/frontend/src/pages/LandingPage.tsx` | Hero CTA "Começar 30 dias grátis" | mantém `href="/register"` (vai pra seletora) — comportamento muda automaticamente |
| `apps/frontend/src/pages/LandingPage.tsx` | Pricing CTA "Começar 30 dias grátis" | mantém `href="/register"` (vai pra seletora) |

A landing continua tendo seu próprio seletor de segmento (cards na seção "Escolha seu segmento") como caminho rápido — clica direto no segmento desejado e pula a tela seletora. A nova `RegisterSegmentPage` é o fallback para CTAs "Comece grátis" genéricos (login, hero da landing, pricing, emails de marketing).

## Testes

Sem testes automatizados específicos — a página é navegação pura. Smoke manual:

1. `/login` → click "Comece grátis" → renderiza tela seletora com 2 cards live + 2 "em breve".
2. Click no card "Oficina Mecânica" → navega para `/register/workshop` → form de oficina renderiza normalmente.
3. Click no card "Recicladoras" → navega para `/register/recycling` → form de recicladora renderiza normalmente.
4. Click no link "Já tem conta? Entrar" → navega para `/login`.
5. Cards "Em breve" não navegam ao clicar (aria-disabled, sem onclick efetivo).
6. Mobile: cards empilham em 1 coluna; toque funciona; layout não quebra.
7. Landing: clicar no card "Oficina Mecânica" da seção "Escolha seu segmento" vai direto para `/register/workshop` (pula a seletora).
8. Landing: hero CTA "Começar 30 dias grátis" vai para a tela seletora.

## Riscos

- **Links externos antigos** apontando para `/register` esperando o cadastro de oficina (ex.: emails antigos, posts em redes) agora caem na tela seletora. Risco baixo: usuário ainda chega num caminho válido, só com um clique extra.
- **SEO**: nada significativo. A rota `/register` muda de propósito, mas não há indexação esperada para uma rota de cadastro.
- **Quebra silenciosa de fluxo**: se algum teste e2e ou link interno (não enumerado nesta análise) esperar `<RegisterPage>` em `/register`, vai falhar. Mitigação: durante implementação, `grep -rn "to=\"/register\"" apps/frontend/src` para validar todos os pontos.

## Fora de escopo

- Unificar `RegisterPage.tsx` e `RegisterRecyclingPage.tsx` numa página única com select interno — refatoração maior, fica como follow-up se a duplicação incomodar futuramente.
- Habilitar Clínica/Odonto — depende de criar os fluxos correspondentes (entity, módulos backend, etc.); fora de escopo desta task.
- Tela seletora dentro do registo (passo 0 do wizard) — abordagem (a) discutida no brainstorming, descartada por exigir refatoração maior.
- Analytics/eventos de tracking nos cliques (qual segmento o usuário escolhe a partir da seletora vs. da landing) — pode entrar como follow-up se for relevante para o produto.
