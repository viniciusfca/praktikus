# Tela seletora de segmento no cadastro — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inserir página `/register` que mostra cards de segmento (Oficina/Recicladoras live + Clínica/Odonto "em breve"), redirecionando para os formulários existentes em `/register/workshop` e `/register/recycling`.

**Architecture:** Página nova `RegisterSegmentPage.tsx` que reusa `<AuthShell>` e replica o visual da seção "Escolha seu segmento" da `LandingPage.tsx`. Rotas reorganizadas em `App.tsx` para inserir a seletora em `/register` sem mexer no conteúdo dos forms existentes.

**Tech Stack:** React 19 + react-router-dom + CoreUI 5.

**Spec:** [docs/superpowers/specs/2026-04-27-register-segment-selector-design.md](../specs/2026-04-27-register-segment-selector-design.md)

---

## File Structure

**Frontend — novos:**
- `apps/frontend/src/pages/auth/RegisterSegmentPage.tsx`

**Frontend — modificados:**
- `apps/frontend/src/App.tsx` (rotas)
- `apps/frontend/src/pages/LandingPage.tsx` (path do card Oficina)

**Frontend — intocados:**
- `apps/frontend/src/pages/auth/RegisterPage.tsx` (continua igual, só muda a rota onde é montado)
- `apps/frontend/src/pages/auth/RegisterRecyclingPage.tsx`
- `apps/frontend/src/pages/auth/LoginPage.tsx` (link "Comece grátis" continua apontando para `/register` — comportamento muda automaticamente)

---

## Phase 1 — Frontend

### Task 1: Criar `RegisterSegmentPage`

**Files:**
- Create: `apps/frontend/src/pages/auth/RegisterSegmentPage.tsx`

- [ ] **Step 1: Criar a página**

Criar `apps/frontend/src/pages/auth/RegisterSegmentPage.tsx` com este conteúdo EXATO:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && cd /home/vinicius/Projetos/vinicius/praktikus && pnpm --filter frontend exec tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: NÃO commitar ainda — vai junto com Task 3 num único commit.**

---

### Task 2: Reorganizar rotas em `App.tsx`

**Files:**
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Adicionar import**

Em `apps/frontend/src/App.tsx`, perto dos imports `RegisterPage` / `RegisterRecyclingPage`, ADICIONAR:

```tsx
import { RegisterSegmentPage } from './pages/auth/RegisterSegmentPage';
```

- [ ] **Step 2: Substituir as rotas existentes**

Localizar as duas linhas:

```tsx
<Route path="/register" element={<RegisterPage />} />
<Route path="/register/recycling" element={<RegisterRecyclingPage />} />
```

Substituir por:

```tsx
<Route path="/register" element={<RegisterSegmentPage />} />
<Route path="/register/workshop" element={<RegisterPage />} />
<Route path="/register/recycling" element={<RegisterRecyclingPage />} />
```

- [ ] **Step 3: Typecheck**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend exec tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: NÃO commitar ainda.**

---

### Task 3: Atualizar path do card Oficina na `LandingPage`

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx`

- [ ] **Step 1: Trocar o path do segmento Oficina**

Localizar no array `segments` (perto da linha 8-14 do arquivo) a entrada da Oficina Mecânica. Atualmente:

```tsx
{
  emoji: '🔧',
  name: 'Oficina Mecânica',
  desc: 'Gestão completa de OS, agendamentos, peças e clientes para oficinas de todo porte.',
  live: true,
  path: '/register',
},
```

Trocar APENAS o `path` para `/register/workshop`:

```tsx
{
  emoji: '🔧',
  name: 'Oficina Mecânica',
  desc: 'Gestão completa de OS, agendamentos, peças e clientes para oficinas de todo porte.',
  live: true,
  path: '/register/workshop',
},
```

(Não mexer nos outros segmentos.)

- [ ] **Step 2: Typecheck e build**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend exec tsc --noEmit
```
Expected: zero errors.

Run build (production):
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend build
```
Expected: `✓ built in ...ms`. Zero errors.

- [ ] **Step 3: Tests**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend test
```
Expected: mesmo baseline da branch atual (78/80, com 2 falhas pré-existentes em `App.test.tsx` e `LoginPage.test.tsx`). DO NOT introduce new failures.

- [ ] **Step 4: Verificar que não restou nenhum link interno apontando para `/register` que devia ir pro workshop**

Run: `grep -rn '"/register"' apps/frontend/src 2>/dev/null`

Saída esperada (lista de ocorrências legítimas):
- `App.tsx`: rota `<Route path="/register" element={<RegisterSegmentPage />} />` ✓ (a rota da seletora)
- `LoginPage.tsx`: link "Comece grátis" `to="/register"` ✓ (vai pra seletora — comportamento desejado)
- `LandingPage.tsx`: hero CTA `href="/register"` e pricing CTA `href="/register"` ✓ (vão pra seletora — comportamento desejado)

NÃO deve haver mais nenhum `path: '/register'` no array de segments da landing (foi trocado para `/register/workshop` neste passo).

- [ ] **Step 5: Commit (atomic)**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus
git add apps/frontend/src/pages/auth/RegisterSegmentPage.tsx \
        apps/frontend/src/App.tsx \
        apps/frontend/src/pages/LandingPage.tsx
git commit -m "feat(auth): add register segment selector page at /register"
```

---

## Phase 2 — Smoke test manual

### Task 4: Validar fluxos no browser

**Files:** (apenas execução)

- [ ] **Step 1: Subir o frontend localmente**

Se o backend já está rodando (docker compose up), só subir o frontend ou usar o container já buildado. Ajuste conforme seu setup atual.

```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend dev
```

- [ ] **Step 2: Smoke checklist**

Abrir o browser e testar cada fluxo abaixo:

1. `http://localhost:5173/login` → click em **"Comece grátis"** → URL muda para `/register` → renderiza tela com 4 cards (2 live, 2 "Em breve") + título "Vamos começar".
2. Click no card **"Oficina Mecânica"** → URL muda para `/register/workshop` → form de cadastro de oficina renderiza normalmente (Stepper "Dados da oficina / Dados do responsável", título "Crie sua conta").
3. Voltar (browser back) → tela seletora de novo. Click em **"Recicladoras"** → URL `/register/recycling` → form de recicladora renderiza ("Dados da empresa / Dados do responsável", subtítulo "Cadastre sua recicladora — 30 dias grátis").
4. Voltar para tela seletora. Click em **"Clínica Médica"** ou **"Odontologia"** → NÃO navega (cards "Em breve" estão desabilitados). Cursor mostra `not-allowed`.
5. Tab/Enter pelos cards: navegação por teclado funciona — Tab foca o card live, Enter ativa o link.
6. Click em **"Já tem conta? Entrar"** no rodapé → volta para `/login`.

7. Em `/` (landing): scroll até a seção "Escolha seu segmento", click no card **"Oficina Mecânica"** → vai DIRETO para `/register/workshop` (pula a seletora). Click no card **"Recicladoras"** → vai direto para `/register/recycling`.

8. Em `/`: hero CTA **"Começar 30 dias grátis"** → vai para `/register` (tela seletora). Mesmo para o pricing CTA.

9. Mobile (DevTools, ≤640px): cards empilham em 1 coluna; toque funciona em cards live; "Em breve" não responde.

10. Dark mode (alternar tema antes de logar — setting do `<ThemeProvider>`): cards continuam legíveis, hover continua visível, badge "Em breve" tem contraste adequado.

- [ ] **Step 3: Push (opcional)**

Se o smoke passar:

```bash
git push origin redesign/praktikus-v2
```

---

## Resumo de commits

1. `feat(auth): add register segment selector page at /register` — Tasks 1+2+3 num commit atômico (a seletora só funciona quando rotas e link da landing estão sincronizados).

---

## Notas

- O fluxo de cadastro em si (campos, validação, criação de tenant/user) **não muda** — só a rota onde os forms ficam montados.
- A `LandingPage` mantém seu próprio seletor de segmento (cards na seção "Escolha seu segmento") como caminho rápido. A `RegisterSegmentPage` é o caminho de fallback quando o usuário clica em CTAs genéricos "Comece grátis".
- Quem chegar em `/register` via link externo antigo ainda completa o fluxo (clica no card Oficina → redireciona). Sem ruptura.
