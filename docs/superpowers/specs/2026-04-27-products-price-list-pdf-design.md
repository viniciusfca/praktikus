# Botão "Imprimir tabela" na página de Produtos (recycling)

**Data:** 2026-04-27
**Branch:** redesign/praktikus-v2
**Escopo:** apenas frontend

---

## Contexto

A `ProductsPage.tsx` (em `apps/frontend/src/pages/recycling/products/`) lista os produtos do tenant com colunas Produto, Unidade, Preço unit. e Status. Hoje não há como imprimir essa lista — quando um cliente chega pedindo a tabela de preços, o usuário precisa anotar manualmente ou tirar print da tela.

A aplicação já tem padrão de geração de PDF via `@react-pdf/renderer`:
- Util `apps/frontend/src/utils/downloadPdf.ts` — `downloadPdf(element, filename)`.
- Componentes existentes: `apps/frontend/src/components/recycling/PurchasePdf.tsx`, `SalePdf.tsx`.
- Dados da empresa via `companyService.getProfile()` em `apps/frontend/src/services/company.service.ts` (retorna `CompanyProfile` com `nomeFantasia`, `cnpj` etc.).

## Objetivo

Adicionar botão "Imprimir tabela" no header da `ProductsPage`. Ao clicar, gera e baixa um PDF com a tabela de preços dos **produtos ativos** do tenant, contendo data e hora da impressão em destaque.

## Decisões de design (validadas no brainstorming)

- **Apenas produtos com `active === true`**, ordenados alfabeticamente por `name`.
- **Sem modal**: ação direta (downloadPdf) ao clicar no botão. `PrintPromptModal` é reservado para fluxos pós-criação de Compra/Venda.
- **Cabeçalho com nome fantasia + CNPJ** da empresa (mesmo padrão do `PurchasePdf`).
- **Data e hora da impressão** em destaque no subtítulo (`dd/MM/yyyy HH:mm`).
- **Footer** com total de itens listados + nota "Esta tabela é válida nesta data e está sujeita a alterações."
- **Sem testes automatizados** — PDF é renderização visual, custo > valor para testes unitários. Smoke manual cobre.

## Arquitetura

### Novo componente: `apps/frontend/src/components/recycling/PriceListPdf.tsx`

Componente `react-pdf/renderer` que renderiza um `<Document>` com uma `<Page>` em A4. Segue o estilo visual de `PurchasePdf.tsx`/`SalePdf.tsx` (fontes, paddings, cores).

**Props:**

```typescript
import type { Product } from '../../services/recycling/products.service';

export interface PriceListPdfProps {
  products: Product[];                                // já filtrados (active=true) e ordenados por name
  empresa: { nomeFantasia: string; cnpj: string };
  printedAt: Date;
}
```

**Layout:**

1. Header: nome fantasia em destaque, CNPJ formatado (com `.` e `/`) abaixo, alinhado à esquerda.
2. Título centralizado: "Tabela de Preços".
3. Subtítulo centralizado, com prefixo "Impresso em" e a data formatada `dd/MM/yyyy HH:mm`.
4. Tabela em 3 colunas:
   - **Produto** (flex, ~60% da largura) — nome em maiúsculas, alinhado à esquerda.
   - **Unidade** (~15%) — sigla (ex.: "kg", "und"), alinhada ao centro.
   - **Preço** (~25%) — formato `R$ X,XX`, alinhado à direita, `font-variant-numeric: tabular-nums`.
5. Linha de cabeçalho da tabela com fundo claro e borda inferior.
6. Cada linha de produto com borda inferior fina (separador).
7. Rodapé com texto de pé de página: "X produtos listados" e "Esta tabela é válida nesta data e está sujeita a alterações."

**Formatadores reutilizados/inline:**
- Preço: `value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })` — mesmo pattern de `formatCurrency` usado em outras pages.
- CNPJ: `formatCnpj(digits)` de `apps/frontend/src/utils/masks.ts` (recebe dígitos puros e retorna `12.345.678/0001-99`). O `company.cnpj` vem como string de dígitos.
- Data: `new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(printedAt)` — sem dependência externa.

### Mudança em `apps/frontend/src/pages/recycling/products/ProductsPage.tsx`

#### 1. Imports adicionais

```tsx
import { cilPrint } from '@coreui/icons';
import { downloadPdf } from '../../../utils/downloadPdf';
import { PriceListPdf } from '../../../components/recycling/PriceListPdf';
import { companyService } from '../../../services/company.service';
```

(`CIcon`, `CButton`, `cilPrint` etc. já estão no projeto.)

#### 2. Estado novo

Adicionar estado local para indicador de loading do botão:

```tsx
const [printing, setPrinting] = useState(false);
const [printError, setPrintError] = useState<string | null>(null);
```

#### 3. Handler `handlePrint`

```tsx
async function handlePrint() {
  setPrintError(null);
  const active = products.filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (active.length === 0) {
    setPrintError('Nenhum produto ativo para imprimir.');
    return;
  }
  setPrinting(true);
  try {
    const company = await companyService.getProfile();
    const printedAt = new Date();
    const dateStr = printedAt.toISOString().slice(0, 10); // YYYY-MM-DD
    await downloadPdf(
      <PriceListPdf
        products={active}
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
}
```

#### 4. Botão no header

A `ProductsPage` tem um header com título "Produtos" e botão "Novo produto" alinhado à direita. Inserir o botão "Imprimir tabela" **à esquerda do "Novo produto"**, com `variant="outline"` para diferenciar visualmente.

```tsx
<div style={{ display: 'flex', gap: 8 }}>
  <CButton
    color="secondary"
    variant="outline"
    onClick={handlePrint}
    disabled={printing || loading || products.length === 0}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}
  >
    {printing ? <CSpinner size="sm" /> : <CIcon icon={cilPrint} size="sm" />}
    Imprimir tabela
  </CButton>
  <CButton color="primary" onClick={openCreate} ...>...</CButton>
</div>
```

(Adaptar ao layout exato existente — provavelmente já há um wrapper flex no header com o botão atual; basta colocar o novo dentro.)

#### 5. Alerta de erro

Mostrar `<CAlert color="danger">{printError}</CAlert>` acima da tabela quando `printError !== null`. Limpar quando o usuário disparar nova ação ou quando alertas equivalentes (de delete, edit) limparem.

## Testes

Sem testes automatizados — `react-pdf/renderer` requer setup de mock pesado para validar output, e o ganho é baixo para um componente puramente visual.

**Smoke manual:**

1. Em `/recycling/products`: clicar "Imprimir tabela" → download de `tabela-precos-YYYY-MM-DD.pdf`.
2. Abrir o PDF → conferir:
   - Cabeçalho com nome fantasia + CNPJ formatado.
   - "Tabela de Preços" centralizado.
   - "Impresso em DD/MM/YYYY HH:MM" — confere com horário do clique.
   - Lista de produtos só com ativos, em ordem alfabética.
   - Coluna Preço alinhada à direita, formato `R$ X,XX`.
   - Footer com contagem correta e texto de validade.
3. Desativar todos os produtos manualmente em ambiente de teste → clicar botão → alerta "Nenhum produto ativo para imprimir." aparece, sem download.
4. Mobile (DevTools): botão visível e clicável; PDF baixa normalmente.

## Riscos

- **`companyService.getProfile()` retorna 404/erro de rede** — capturado pelo try/catch, mostra alerta. Não trava a página.
- **Listas longas (>100 produtos)** — `react-pdf` quebra automaticamente em múltiplas páginas se a `<Page>` usar layout flex normal. Verificar no smoke se necessário, mas não bloqueante.
- **Preços com mais de 2 casas decimais** vindos do backend — `toLocaleString` com `style: 'currency'` arredonda para 2 casas. Aceitável.
- **Acentuação em PDF**: react-pdf tem suporte nativo a UTF-8 com fontes padrão; não esperamos problemas com pt-BR.

## Fora de escopo

- Filtro de busca/seleção antes de imprimir (escolher quais produtos imprimir).
- Logo da empresa no PDF (existe `company.logoUrl` mas requer `<Image>` do react-pdf + lidar com CORS — adicionar quando solicitado).
- Botão equivalente em outras páginas (compradores, fornecedores, vendas, etc.).
- Compartilhamento via WhatsApp/email — somente download local.
- Customização do layout pelo usuário (cores, tamanho de fonte).
