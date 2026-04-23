# Design — Impressão de PDF para Compras e Vendas (Recicláveis)

**Data:** 2026-04-20
**Segmento:** Recicláveis
**Autor:** Vini Souza (via brainstorming)

---

## 1. Contexto

Hoje as páginas `/recycling/purchases` e `/recycling/sales` permitem registrar e consultar compras/vendas, mas não geram comprovante imprimível. Em operação de balcão (sucata), o fornecedor/comprador costuma pedir um papel assinado. Workshop já tem geração de PDF via `OsPdf.tsx` + `@react-pdf/renderer` (`ServiceOrderDetailPage.handleDownloadPdf`) — temos um padrão validado a seguir.

Requisitos do brainstorming:
- Gerar PDF do comprovante em dois pontos: **(i)** depois de finalizar a criação numa página `/new`, perguntando se quer imprimir; **(ii)** no modal de detalhe que abre ao clicar numa linha do histórico.
- Abordagem A confirmada: dois componentes PDF dedicados (`PurchasePdf`, `SalePdf`), modal de prompt pós-criação compartilhado, helper de download extraído pra utilitário.
- Assinatura: uma única linha ao final — "Assinatura do fornecedor" (compras) / "Assinatura do comprador" (vendas).
- Fluxo pós-criação: modal com botões `Imprimir` + `Fechar`, backdrop estático para forçar decisão explícita.

## 2. Meta

Entregar impressão de comprovante PDF para compras e vendas com:

- Novos componentes `PurchasePdf` e `SalePdf` em `components/recycling/`
- `PrintPromptModal` compartilhado em `components/`
- Helper `downloadPdf` em `utils/`
- Botão "Imprimir PDF" nos dois modais de detalhe existentes
- Prompt pós-criação nas duas páginas `/new`
- Refactor oportunista: `ServiceOrderDetailPage.handleDownloadPdf` passa a consumir o helper

## 3. UX flows

### 3.1 Pós-criação (NewPurchasePage / NewSalePage)

Fluxo atual: `onSubmit` → `service.create(dto)` → `navigate('/recycling/purchases')`.

Novo fluxo:
1. `onSubmit` chama `service.create(dto)` e captura o `{ id }` retornado.
2. Em vez de navegar direto, abre `PrintPromptModal` com `open=true` e armazena o id.
3. O modal mostra:
   - Título: `Compra registrada` ou `Venda registrada`
   - Mensagem: `Deseja imprimir o comprovante?`
   - Botões: `Imprimir PDF` (primary) + `Fechar` (outline secondary)
4. `backdrop="static" keyboard={false}` — sem dismiss por clique fora ou ESC.
5. Ao clicar `Imprimir PDF`:
   - Spinner inline no botão.
   - Chama `service.getById(id)` + `companyService.get()` em paralelo.
   - Gera blob via `downloadPdf(<PurchasePdf purchase={detail} empresa={...}/>, 'Compra-{shortId}.pdf')`.
   - Após sucesso, navega para o histórico.
6. Ao clicar `Fechar`: navega imediatamente para o histórico sem gerar PDF.
7. Se o passo 5 falhar (rede/PDF): renderiza `CAlert danger` acima dos botões; ambos permanecem habilitados. `Fechar` ainda navega normalmente.

### 3.2 Histórico (PurchaseDetailModal / SaleDetailModal)

Layout do footer atualizado:

```
[ Imprimir PDF ]                               [ Fechar ]
  outline primary                               outline secondary
```

Ao clicar `Imprimir PDF`:
- Spinner substitui o label do botão.
- Reusa `downloadPdf()` com o `detail` já carregado no state do modal — sem nova chamada pra `getById`.
- `companyService.get()` é chamado na hora (com cache simples por mount).
- Erro: reaproveita o `CAlert` existente do modal para mostrar a mensagem.

### 3.3 Sem mudanças nas rotas
Não criamos rotas dedicadas nem redirects. Toda a interação é modal + download do blob.

## 4. Componentes PDF

### 4.1 `PurchasePdf.tsx`

Props:

```ts
type PurchasePdfProps = {
  purchase: PurchaseDetail;                  // services/recycling/purchases.service
  empresa: { nomeFantasia: string };
};
```

Estrutura (A4, paleta/fontes iguais ao `OsPdf`):

**Header (flex row, space-between):**
- Esquerda: tile "P" teal + `empresa.nomeFantasia` (Helvetica-Bold 16)
- Direita: kicker `COMPROVANTE DE COMPRA` + número `#{id.slice(0,8).toUpperCase()}` (Courier-Bold 14) + data de emissão `DD/MM/YYYY`

**Seção "Fornecedor e operador" (two-column):**
- Col 1: label `FORNECEDOR` · nome · subtítulo com `formatDocument(doc, type)` se existir
- Col 2: label `OPERADOR` · nome · subtítulo `Registrado em {DD/MM/YYYY HH:mm}` (via `toLocaleString('pt-BR')`)

**Seção "Pagamento":**
- Linha única, label `MÉTODO DE PAGAMENTO` · texto (`Dinheiro` / `PIX` / `Cartão`). Mapeamento duplicado de `PaymentBadge` como texto puro; sem badge visual no PDF.

**Seção "Itens" (tabela):**
- Header: `Produto` (flex 3, esquerda) · `Qtd` (flex 1, direita) · `Preço/kg` (flex 1, direita) · `Subtotal` (flex 1, direita)
- Linhas: nome do produto · `{quantity} kg` · `formatCurrency(unitPrice)` · `formatCurrency(subtotal)` em bold

**Totais (bloco à direita, 260pt largura):**
- Linha `Volume total` · `{totalKg} kg` (tabular-nums)
- Separador 2px top-border petrol
- Linha final `TOTAL` (Helvetica-Bold 11 petrol) · `formatCurrency(total)` (Helvetica-Bold 13 petrol)

**Observações** (só se `purchase.notes` presente):
- Label `OBSERVAÇÕES`
- Bloco de texto FG; quebras de linha do `notes` são preservadas (o `<Text>` do `@react-pdf` respeita `\n` literais).

**Assinatura (single line, marginTop 50pt):**
- `Assinatura do fornecedor`

**Footer (centralizado, 9pt muted, top border):**
- `Obrigado pela preferência — {empresa.nomeFantasia}`

### 4.2 `SalePdf.tsx`

Estruturalmente idêntico a `PurchasePdf`, com estas substituições:

| `PurchasePdf` | `SalePdf` |
|---|---|
| kicker `COMPROVANTE DE COMPRA` | `COMPROVANTE DE VENDA` |
| label `FORNECEDOR` | `COMPRADOR` |
| Seção "Pagamento" | **removida** (sales não tem `paymentMethod` no entity) |
| `Assinatura do fornecedor` | `Assinatura do comprador` |
| Filename `Compra-{shortId}.pdf` | `Venda-{shortId}.pdf` |

Props:

```ts
type SalePdfProps = {
  sale: SaleDetail;                          // services/recycling/sales.service
  empresa: { nomeFantasia: string };
};
```

Observação: `SaleDetail.buyer.document` / `documentType` podem existir (a service já expõe; entity backend usa `cnpj` legacy, mas a shape da API inclui os dois). Se `document` for null, modal já trata — PDF faz o mesmo.

## 5. Componentes/utilitários compartilhados

### 5.1 `utils/downloadPdf.ts`

```ts
import { pdf } from '@react-pdf/renderer';

export async function downloadPdf(
  element: React.ReactElement,
  filename: string,
): Promise<void> {
  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

Throws se `pdf(...).toBlob()` rejeitar — caller trata.

Refactor oportunista: `ServiceOrderDetailPage.handleDownloadPdf` passa a chamar `downloadPdf(<OsPdf .../>, 'OS-{shortId}.pdf')`, removendo o inline blob-creation pattern.

### 5.2 `components/PrintPromptModal.tsx`

```ts
type PrintPromptModalProps = {
  open: boolean;
  title: string;                    // "Compra registrada" | "Venda registrada"
  message: string;                  // "Deseja imprimir o comprovante?"
  onPrint: () => Promise<void>;     // caller wires up getById + downloadPdf
  onClose: () => void;              // caller wires up navigate
};
```

Comportamento interno:
- `backdrop="static" keyboard={false}` — forçar decisão.
- State interno `loading: boolean` e `error: string | null`.
- Botão `Imprimir PDF`: `disabled={loading}`; label troca para `<CSpinner size="sm"/>` quando `loading`.
- Botão `Fechar`: sempre habilitado; chama `onClose` direto.
- Ao clicar `Imprimir PDF`: set `loading=true`, `error=null`, `await onPrint()`, catch: `setError('Erro ao gerar PDF.')`, finally: `setLoading(false)`.
- Sucesso: caller é responsável por navegar (o modal só dispara o callback).

Renderização:
- Header: `{title}`
- Body: `{message}` + `CAlert danger` se `error`
- Footer: `[Imprimir PDF]  [Fechar]` (Imprimir à esquerda, primary; Fechar à direita, outline secondary — ordem inversa aos padrões CoreUI, mas alinha com o fluxo de ler-esquerda-pra-direita "Imprimir ou Fechar")

Localização: `components/` (não `components/recycling/`) — o componente é genérico; se workshop amanhã quiser o mesmo prompt para OS, reusa.

## 6. Dados de entrada

**Pós-create:**
- `service.create(dto)` retorna o entity com `id`.
- Em seguida o `onPrint` do caller chama `service.getById(id)` + `companyService.get()` em paralelo (Promise.all).
- Passa `{ [purchase|sale]: detail, empresa: company }` ao PDF.

**Detail modal:**
- `detail` já está no state local (carregado pelo `useEffect` que dispara em `purchaseId/saleId` change).
- `companyService.get()` é chamado no clique do `Imprimir PDF` (não pre-fetch). Nenhum cache — cada clique faz uma chamada. A frequência esperada é baixa (um usuário não imprime a mesma transação várias vezes seguidas); simplicidade vale mais que economia marginal.

**Fallback empresa:** se `companyService.get()` falhar, usa `{ nomeFantasia: 'Praktikus' }`. PDF sai de qualquer forma.

## 7. Arquivos

### Frontend

**Criar:**
- `apps/frontend/src/utils/downloadPdf.ts`
- `apps/frontend/src/components/PrintPromptModal.tsx`
- `apps/frontend/src/components/recycling/PurchasePdf.tsx`
- `apps/frontend/src/components/recycling/SalePdf.tsx`

**Modificar:**
- `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx` — `handleDownloadPdf` passa a usar `downloadPdf` helper
- `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx` — integra `PrintPromptModal` no fluxo pós-`create`
- `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx` — idem
- `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx` — adiciona botão `Imprimir PDF` no footer
- `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx` — idem

### Backend
Zero mudanças. Todos os endpoints consumidos (`GET /recycling/purchases/:id`, `GET /recycling/sales/:id`, `GET /companies/current`) já existem com guards corretos.

## 8. Permissões e segurança

- Geração 100% client-side (`@react-pdf/renderer` roda no browser, sem chamada server-side além do `getById`/`company`).
- Endpoints usados já são tenant-scoped.
- O PDF só contém dados que o usuário autenticado já tem permissão para ver (o `getById` enforça isso).

## 9. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `companyService.get()` falhar | Fallback para `{ nomeFantasia: 'Praktikus' }`; PDF ainda gera |
| `getById` lento pós-create (200–500ms) | Spinner no botão `Imprimir PDF`; decisão UX já aceita |
| Layout quebra com nome de produto muito longo | `@react-pdf` faz word-wrap nativo nas células; teste manual com nome de 80+ chars |
| Usuário fecha tab durante `toBlob()` | `toBlob` é in-process; fechamento aborta sem side-effects server-side |
| PDF duplica esforço vs `PurchasePdf`/`SalePdf` | Aceito (Abordagem A do brainstorming). Divergência futura esperada (compras podem ganhar NF do fornecedor, vendas podem ganhar retenção). |
| `ServiceOrderDetailPage` regredir após refactor | Helper tem exatamente o mesmo comportamento (mesmo `blob`+`<a download>`+`revoke`); teste manual rápido de impressão de OS |

## 10. Rollout sugerido (ordem de commits)

1. `utils/downloadPdf.ts` + refactor de `ServiceOrderDetailPage.handleDownloadPdf` (pura extração, sem mudança de comportamento visível)
2. `components/PrintPromptModal.tsx` (sem consumer ainda — stub isolado)
3. `components/recycling/PurchasePdf.tsx` (componente puro, sem integração)
4. `components/recycling/SalePdf.tsx` (idem)
5. Integração em `PurchaseDetailModal` (botão `Imprimir PDF`)
6. Integração em `SaleDetailModal` (idem)
7. Integração em `NewPurchasePage` (prompt pós-create)
8. Integração em `NewSalePage` (idem)

Entregável como PR único; 8 commits individualmente reversíveis.

## 11. Testes manuais de aceitação

- Criar compra com 1 item (balcão, PIX) → modal aparece → clicar `Imprimir` → PDF baixa com dados corretos → navega para `/recycling/purchases`
- Criar compra → clicar `Fechar` → navega imediatamente, sem PDF
- Criar venda com 3 itens → modal → `Imprimir` → PDF baixa como `Venda-{id}.pdf`
- Histórico de compras: clicar linha → modal detalhe → `Imprimir PDF` → baixa com os mesmos dados exibidos
- Idem para vendas
- Compra com fornecedor **sem documento** cadastrado: PDF mostra nome sem subtítulo, layout não quebra
- Compra com 15+ itens: tabela pagina automaticamente (múltiplas páginas do PDF; `@react-pdf` resolve nativamente — só confirmar visualmente)
- Observação com quebras de linha: `\n` preservado no PDF
- Simular falha no `companyService.get()` (ex: desligar o endpoint): PDF ainda gera com fallback `Praktikus`
- OS workshop: imprimir uma OS existente para confirmar que o refactor não regrediu
