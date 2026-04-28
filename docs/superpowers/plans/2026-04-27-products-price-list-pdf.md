# Tabela de preços PDF na página de Produtos — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão "Imprimir tabela" no header da página de Produtos do recycling. Ao clicar, gera PDF com lista de produtos ativos (Produto, Unidade, Preço), data/hora da impressão e dados da empresa.

**Architecture:** Novo componente `PriceListPdf.tsx` em `components/recycling/` usando `@react-pdf/renderer` (mesmo padrão de `PurchasePdf.tsx`/`SalePdf.tsx`). Botão na `ProductsPage` chama `companyService.getProfile()` + `downloadPdf()`.

**Tech Stack:** React 19 + @react-pdf/renderer + CoreUI 5.

**Spec:** [docs/superpowers/specs/2026-04-27-products-price-list-pdf-design.md](../specs/2026-04-27-products-price-list-pdf-design.md)

---

## File Structure

**Novos:**
- `apps/frontend/src/components/recycling/PriceListPdf.tsx`

**Modificados:**
- `apps/frontend/src/pages/recycling/products/ProductsPage.tsx`

**Sem novos testes automatizados** (PDF é renderização visual — smoke manual cobre).

---

## Task 1: Criar `PriceListPdf.tsx`

**Files:**
- Create: `apps/frontend/src/components/recycling/PriceListPdf.tsx`

### Step 1.1: Criar o componente

Criar `apps/frontend/src/components/recycling/PriceListPdf.tsx` com este conteúdo EXATO:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCnpj } from '../../utils/masks';

export interface PriceListPdfRow {
  name: string;
  unitSymbol: string;
  pricePerUnit: number;
}

export interface PriceListPdfProps {
  rows: PriceListPdfRow[];
  empresa: { nomeFantasia: string; cnpj: string };
  printedAt: Date;
}

const fmtMoney = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);

const TEAL = '#348E91';
const FG = '#0F1414';
const MUTED = '#5A6464';
const SUBTLE = '#8A9393';
const BORDER = '#E4E7E7';
const BORDER_SOFT = '#EEF0F0';
const CAP_BG = '#F7F8F8';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: FG, lineHeight: 1.4 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 16, marginBottom: 22,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: {
    width: 22, height: 22, borderRadius: 5, backgroundColor: TEAL, color: '#fff',
    fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingTop: 3,
  },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: FG },
  brandSub: { fontSize: 9, color: MUTED, marginTop: 2 },
  headerRight: { textAlign: 'right', alignItems: 'flex-end' },
  kicker: {
    fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
  },
  printedAt: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: FG, marginTop: 2 },

  title: {
    fontSize: 18, fontFamily: 'Helvetica-Bold', color: FG,
    textAlign: 'center', marginBottom: 4,
  },
  subtitle: {
    fontSize: 10, color: MUTED, textAlign: 'center', marginBottom: 22,
  },

  tHead: {
    flexDirection: 'row', backgroundColor: CAP_BG, padding: 6, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: BORDER, borderTopWidth: 1, borderTopColor: BORDER,
  },
  tHeadText: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  tRow: {
    flexDirection: 'row', padding: 6, paddingVertical: 7,
    borderBottomWidth: 0.5, borderBottomColor: BORDER_SOFT,
  },
  tText: { fontSize: 10, color: FG },
  tTextBold: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: FG },

  colName: { flex: 6 },
  colUnit: { flex: 1.5, textAlign: 'center' },
  colPrice: { flex: 2, textAlign: 'right' },

  footer: {
    marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER,
    fontSize: 9, color: SUBTLE,
  },
  footerLine: { textAlign: 'center', marginBottom: 4 },
});

export function PriceListPdf({ rows, empresa, printedAt }: PriceListPdfProps) {
  const cnpjFormatted = empresa.cnpj ? formatCnpj(empresa.cnpj) : '';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <View style={s.brandRow}>
              <Text style={s.tile}>P</Text>
              <Text style={s.brandName}>{empresa.nomeFantasia}</Text>
            </View>
            {cnpjFormatted ? <Text style={s.brandSub}>CNPJ {cnpjFormatted}</Text> : null}
          </View>
          <View style={s.headerRight}>
            <Text style={s.kicker}>Tabela de Preços</Text>
            <Text style={s.printedAt}>{fmtDateTime(printedAt)}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={s.title}>Tabela de Preços</Text>
        <Text style={s.subtitle}>Impresso em {fmtDateTime(printedAt)}</Text>

        {/* Table */}
        <View>
          <View style={s.tHead}>
            <Text style={[s.tHeadText, s.colName]}>Produto</Text>
            <Text style={[s.tHeadText, s.colUnit]}>Unidade</Text>
            <Text style={[s.tHeadText, s.colPrice]}>Preço</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={s.tRow}>
              <Text style={[s.tText, s.colName]}>{row.name}</Text>
              <Text style={[s.tText, s.colUnit]}>{row.unitSymbol}</Text>
              <Text style={[s.tTextBold, s.colPrice]}>{fmtMoney(row.pricePerUnit)}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerLine}>
            {rows.length} {rows.length === 1 ? 'produto listado' : 'produtos listados'}
          </Text>
          <Text style={s.footerLine}>
            Esta tabela é válida nesta data e está sujeita a alterações.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
```

### Step 1.2: Typecheck

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && cd /home/vinicius/Projetos/vinicius/praktikus && pnpm --filter frontend exec tsc --noEmit
```
Expected: zero errors.

### Step 1.3: NÃO commitar ainda — vai junto com Task 2 num único commit.

---

## Task 2: Botão e handler em `ProductsPage.tsx`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/products/ProductsPage.tsx`

### Step 2.1: Adicionar imports

No topo do arquivo, atualizar/adicionar:

```tsx
import { useState, useEffect, useCallback } from 'react';
// ... outros imports existentes ...
import { cilPlus, cilPen, cilPrint, cilRecycle } from '@coreui/icons';  // adiciona cilPrint
// ... outros imports ...
import { downloadPdf } from '../../../utils/downloadPdf';
import { PriceListPdf } from '../../../components/recycling/PriceListPdf';
import { companyService } from '../../../services/company.service';
```

(O `cilPrint` deve ser adicionado à lista existente. As outras 3 linhas são novas.)

### Step 2.2: Adicionar estado de loading/erro do print

Dentro do componente principal `ProductsPage()`, perto dos outros `useState`, ADICIONAR:

```tsx
const [printing, setPrinting] = useState(false);
const [printError, setPrintError] = useState<string | null>(null);
```

### Step 2.3: Adicionar o handler `handlePrint`

Próximo aos outros handlers (`openCreate`, `setEditing`...), ADICIONAR. O handler resolve `unitId → unit.abbreviation` usando o array `units` que já existe no estado da página (carregado em paralelo com `products` via `unitsService.list()`):

```tsx
const handlePrint = async () => {
  setPrintError(null);
  const active = products
    .filter((p) => p.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (active.length === 0) {
    setPrintError('Nenhum produto ativo para imprimir.');
    return;
  }
  const rows = active.map((p) => {
    const unit = units.find((u) => u.id === p.unitId);
    return {
      name: p.name,
      unitSymbol: unit?.abbreviation ?? '—',
      pricePerUnit: Number(p.pricePerUnit),
    };
  });
  setPrinting(true);
  try {
    const company = await companyService.getProfile();
    const printedAt = new Date();
    const dateStr = printedAt.toISOString().slice(0, 10);
    await downloadPdf(
      <PriceListPdf
        rows={rows}
        empresa={{ nomeFantasia: company.nomeFantasia, cnpj: company.cnpj }}
        printedAt={printedAt}
      />,
      `tabela-precos-${dateStr}.pdf`,
    );
  } catch {
    setPrintError('Erro ao gerar PDF. Tente novamente.');
  } finally {
    setPrinting(false);
  }
};
```

### Step 2.4: Inserir botão no header

No JSX do header da página (próximo à linha 263, onde está o `<CButton color="primary" onClick={openCreate}>`), envolver o botão atual num wrapper flex e adicionar o novo botão à esquerda:

ANTES:

```tsx
        <CButton
          color="primary"
          onClick={openCreate}
          style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <CIcon icon={cilPlus} size="sm" /> Novo produto
        </CButton>
```

DEPOIS:

```tsx
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <CButton
            color="secondary"
            variant="outline"
            onClick={handlePrint}
            disabled={printing || products.length === 0}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {printing ? <CSpinner size="sm" /> : <CIcon icon={cilPrint} size="sm" />}
            Imprimir tabela
          </CButton>
          <CButton
            color="primary"
            onClick={openCreate}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilPlus} size="sm" /> Novo produto
          </CButton>
        </div>
```

### Step 2.5: Mostrar alerta de erro

Encontrar o ponto onde o erro de carregamento é exibido (procurar `{error && <CAlert color="danger"`). Acima ou abaixo daquele alerta, ADICIONAR um alerta paralelo para `printError`:

```tsx
{printError && <CAlert color="danger" className="mb-0">{printError}</CAlert>}
```

(Manter o alerta `error` existente; só adicionar este novo bloco logo abaixo.)

### Step 2.6: Validação

Run typecheck:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && cd /home/vinicius/Projetos/vinicius/praktikus && pnpm --filter frontend exec tsc --noEmit
```
Expected: zero errors.

Run build:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend build
```
Expected: `✓ built in ...ms`.

Run tests:
```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend test
```
Expected: 78/80 baseline. Sem novas falhas.

### Step 2.7: Commit (atômico — Tasks 1+2)

```bash
cd /home/vinicius/Projetos/vinicius/praktikus
git add apps/frontend/src/components/recycling/PriceListPdf.tsx \
        apps/frontend/src/pages/recycling/products/ProductsPage.tsx
git commit -m "feat(products): add price list PDF print button"
```

---

## Task 3: Smoke test manual

**Files:** (apenas execução)

### Step 3.1: Subir o frontend

Se Docker:

```bash
docker compose up -d --build frontend
```

Ou em dev:

```bash
source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && pnpm --filter frontend dev
```

### Step 3.2: Smoke checklist

Em `/recycling/products`:

1. Header agora tem **dois botões**: "Imprimir tabela" (outline) e "Novo produto" (primary).
2. Click em "Imprimir tabela" → arquivo `tabela-precos-YYYY-MM-DD.pdf` baixa.
3. Abrir o PDF e conferir:
   - **Cabeçalho esquerdo**: tile "P" + nome fantasia da empresa + linha "CNPJ XX.XXX.XXX/XXXX-XX" abaixo.
   - **Cabeçalho direito**: kicker "TABELA DE PREÇOS" + horário da impressão (ex.: `27/04/26 12:56`).
   - **Título centralizado**: "Tabela de Preços".
   - **Subtítulo**: "Impresso em DD/MM/AA HH:MM".
   - **Tabela** com 3 colunas (Produto, Unidade, Preço); apenas produtos ativos; ordem alfabética; preço alinhado à direita; preço em formato `R$ X,XX`.
   - **Footer**: "X produtos listados" + "Esta tabela é válida nesta data e está sujeita a alterações."
4. **Empty state**: desativar todos os produtos do tenant manualmente (toggle "Ativo" → "Inativo" via UI). Click "Imprimir tabela" → alerta "Nenhum produto ativo para imprimir." aparece. Sem download. Reativar pelo menos um produto depois.
5. **Botão desabilita** durante o spinner (clicar duas vezes rápido não gera dois PDFs).
6. **Mobile (DevTools)**: botão visível e tocável; PDF baixa.

### Step 3.3: Push (opcional)

Se smoke passar:

```bash
git push origin redesign/praktikus-v2
```

---

## Resumo de commits

1. `feat(products): add price list PDF print button` — PriceListPdf + ProductsPage juntos.
