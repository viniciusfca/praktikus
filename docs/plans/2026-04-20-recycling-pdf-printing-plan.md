# Recycling Purchase/Sale PDF Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF receipt generation for recycling purchases and sales, accessible from two points — a prompt modal after finalizing `/new` and an `Imprimir PDF` button in the existing detail modals.

**Architecture:** Mirrors the existing `OsPdf`/`ServiceOrderDetailPage.handleDownloadPdf` pattern. Introduces two dedicated PDF components (`PurchasePdf`, `SalePdf`), one shared `PrintPromptModal`, and a `downloadPdf` utility extracted from the current inline pattern. All generation is client-side via `@react-pdf/renderer`; no backend changes.

**Tech Stack:** React 19, `@react-pdf/renderer` v4.3.2 (already installed), CoreUI for the prompt modal.

**Spec:** `docs/plans/2026-04-20-recycling-pdf-printing-design.md`

---

## File Structure

### Create
- `apps/frontend/src/utils/downloadPdf.ts` — shared `async downloadPdf(element, filename)` that wraps `pdf().toBlob()` → anchor click → revoke
- `apps/frontend/src/components/PrintPromptModal.tsx` — generic modal with `Imprimir PDF` + `Fechar`, `backdrop="static"`, spinner on print, inline error alert
- `apps/frontend/src/components/recycling/PurchasePdf.tsx` — A4 receipt for a purchase (supplier, items, totals, optional notes, signature line)
- `apps/frontend/src/components/recycling/SalePdf.tsx` — same structure for a sale (buyer instead of supplier, no payment section)

### Modify
- `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx` — refactor `handleDownloadPdf` to use the new `downloadPdf` helper
- `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx` — add `Imprimir PDF` button in footer
- `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx` — add `Imprimir PDF` button in footer
- `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx` — swap direct `navigate` after `create()` for `PrintPromptModal`
- `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx` — same

---

## Conventions

- **Frontend-only feature** — no backend tests. The gate at each task is `tsc --noEmit` from `apps/frontend`.
- **Git signing** — `--no-gpg-sign` is pre-authorized (SSH key has a passphrase that isn't unlocked).
- **Working branch** — `redesign/praktikus-v2`. Three unrelated uncommitted files (sidebar fixes) from earlier in the session — leave alone.
- **Working directory** — `/home/vinicius/Projetos/vinicius/praktikus`.
- **Type-check command** — `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`

---

## Task 1: `downloadPdf` utility + `ServiceOrderDetailPage` refactor

**Files:**
- Create: `apps/frontend/src/utils/downloadPdf.ts`
- Modify: `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx` — replace the inline blob pattern in `handleDownloadPdf` with a call to `downloadPdf`

- [ ] **Step 1.1: Create the helper**

Create `apps/frontend/src/utils/downloadPdf.ts` with EXACTLY this content:

```typescript
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

- [ ] **Step 1.2: Refactor `ServiceOrderDetailPage.handleDownloadPdf`**

Edit `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx`.

Replace the existing import at line 42 (`import { pdf } from '@react-pdf/renderer';`) with:

```typescript
import { downloadPdf } from '../../../utils/downloadPdf';
```

Then find the `handleDownloadPdf` function (around line 407) and replace the entire function body with:

```typescript
  const handleDownloadPdf = async () => {
    if (!so || !empresa || !customer || !vehicle) return;
    try {
      await downloadPdf(
        <OsPdf
          so={so}
          empresa={{ nomeFantasia: empresa.nomeFantasia }}
          cliente={{ nome: customer.nome, cpfCnpj: customer.cpfCnpj }}
          veiculo={{ placa: vehicle.placa, marca: vehicle.marca, modelo: vehicle.modelo, ano: vehicle.ano }}
        />,
        `OS-${so.id.slice(0, 8).toUpperCase()}.pdf`,
      );
    } catch {
      setError('Erro ao gerar PDF.');
    }
  };
```

- [ ] **Step 1.3: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 1.4: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/utils/downloadPdf.ts apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
refactor(pdf): extract downloadPdf helper from ServiceOrderDetailPage

Moves the inline pdf(...).toBlob() + anchor-click pattern into
utils/downloadPdf.ts so recycling PDFs can share it. Behavior is
identical (same blob, same anchor, same revokeObjectURL in finally).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `PrintPromptModal` component

**Files:**
- Create: `apps/frontend/src/components/PrintPromptModal.tsx`

- [ ] **Step 2.1: Create the component**

Create `apps/frontend/src/components/PrintPromptModal.tsx` with EXACTLY this content:

```tsx
import { useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
} from '@coreui/react';

export interface PrintPromptModalProps {
  open: boolean;
  title: string;
  message: string;
  onPrint: () => Promise<void>;
  onClose: () => void;
}

export function PrintPromptModal({
  open,
  title,
  message,
  onPrint,
  onClose,
}: PrintPromptModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = async () => {
    setLoading(true);
    setError(null);
    try {
      await onPrint();
    } catch {
      setError('Erro ao gerar PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CModal
      visible={open}
      onClose={onClose}
      alignment="center"
      backdrop="static"
      keyboard={false}
    >
      <CModalHeader closeButton={false}>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cui-body-color)' }}>
          {message}
        </p>
        {error && (
          <CAlert color="danger" className="mt-3 mb-0">{error}</CAlert>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton
          color="primary"
          onClick={handlePrint}
          disabled={loading}
          style={{ minWidth: 130 }}
        >
          {loading ? <CSpinner size="sm" /> : 'Imprimir PDF'}
        </CButton>
        <CButton color="secondary" variant="outline" onClick={onClose}>
          Fechar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
```

- [ ] **Step 2.2: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 2.3: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/components/PrintPromptModal.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(pdf): PrintPromptModal for post-create print decision

Generic modal with Imprimir PDF / Fechar buttons. Backdrop static
and keyboard disabled force an explicit choice. Spinner state on
the print button; error alert inline when onPrint rejects.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `PurchasePdf` component

**Files:**
- Create: `apps/frontend/src/components/recycling/PurchasePdf.tsx`

- [ ] **Step 3.1: Create the component**

Create `apps/frontend/src/components/recycling/PurchasePdf.tsx` with EXACTLY this content:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseDetail } from '../../services/recycling/purchases.service';

export interface PurchasePdfProps {
  purchase: PurchaseDetail;
  empresa: { nomeFantasia: string };
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão',
};

function formatDocument(doc: string | null, type: 'CPF' | 'CNPJ' | null): string | null {
  if (!doc) return null;
  if (type === 'CPF' && doc.length === 11) {
    return `CPF ${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if ((type === 'CNPJ' || !type) && doc.length === 14) {
    return `CNPJ ${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}

const TEAL = '#348E91';
const PETROL = '#1C5052';
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
  headerRight: { textAlign: 'right', alignItems: 'flex-end' },
  kicker: {
    fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
  },
  docNumber: { fontSize: 14, fontFamily: 'Courier-Bold', color: FG, marginTop: 2 },
  docDate: { fontSize: 9, color: MUTED, marginTop: 1 },

  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },

  twoCol: { flexDirection: 'row', gap: 20 },
  col: { flex: 1 },
  label: {
    fontSize: 9, color: SUBTLE, marginBottom: 2, textTransform: 'uppercase',
    letterSpacing: 0.6, fontFamily: 'Helvetica-Bold',
  },
  value: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: FG },
  valueSub: { fontSize: 9, color: MUTED, marginTop: 1 },

  tHead: {
    flexDirection: 'row', backgroundColor: CAP_BG, padding: 6, paddingVertical: 5,
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
  c3: { flex: 3 },
  colNum: { flex: 1, textAlign: 'right' },

  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  totalsBox: { width: 260 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalsLabel: { fontSize: 10, color: MUTED },
  totalsValue: { fontSize: 10, color: FG },
  totalsSep: { borderTopWidth: 2, borderTopColor: PETROL, marginTop: 4, paddingTop: 8 },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between' },
  totalFinalLabel: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: PETROL, letterSpacing: 1,
  },
  totalFinalValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: PETROL },

  notesBox: {
    padding: 10, backgroundColor: CAP_BG, borderRadius: 4,
    fontSize: 10, color: FG, marginTop: 4,
  },

  signature: { marginTop: 50 },
  signatureLine: {
    borderTopWidth: 1, borderTopColor: FG, paddingTop: 5,
    textAlign: 'center', fontSize: 9, color: MUTED,
    width: 280, alignSelf: 'center',
  },

  footer: {
    marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER,
    textAlign: 'center', fontSize: 9, color: SUBTLE,
  },
});

export function PurchasePdf({ purchase, empresa }: PurchasePdfProps) {
  const totalKg = purchase.items.reduce((a, it) => a + Number(it.quantity), 0);
  const docNumber = `#${purchase.id.slice(0, 8).toUpperCase()}`;
  const emittedDate = new Date(purchase.purchasedAt).toLocaleDateString('pt-BR');
  const registeredAt = new Date(purchase.purchasedAt).toLocaleString('pt-BR');
  const supplierDoc = formatDocument(purchase.supplier.document, purchase.supplier.documentType);
  const paymentLabel = PAYMENT_LABEL[purchase.paymentMethod] ?? purchase.paymentMethod;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brandRow}>
            <Text style={s.tile}>P</Text>
            <Text style={s.brandName}>{empresa.nomeFantasia}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.kicker}>Comprovante de Compra</Text>
            <Text style={s.docNumber}>{docNumber}</Text>
            <Text style={s.docDate}>Emitida em {emittedDate}</Text>
          </View>
        </View>

        {/* Fornecedor e operador */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Fornecedor e operador</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={s.label}>Fornecedor</Text>
              <Text style={s.value}>{purchase.supplier.name || '—'}</Text>
              {supplierDoc ? <Text style={s.valueSub}>{supplierDoc}</Text> : null}
            </View>
            <View style={s.col}>
              <Text style={s.label}>Operador</Text>
              <Text style={s.value}>{purchase.operator.name || '—'}</Text>
              <Text style={s.valueSub}>Registrado em {registeredAt}</Text>
            </View>
          </View>
        </View>

        {/* Pagamento */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Pagamento</Text>
          <Text style={s.label}>Método de pagamento</Text>
          <Text style={s.value}>{paymentLabel}</Text>
        </View>

        {/* Itens */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Itens</Text>
          <View style={s.tHead}>
            <Text style={[s.tHeadText, s.c3]}>Produto</Text>
            <Text style={[s.tHeadText, s.colNum]}>Qtd</Text>
            <Text style={[s.tHeadText, s.colNum]}>Preço/kg</Text>
            <Text style={[s.tHeadText, s.colNum]}>Subtotal</Text>
          </View>
          {purchase.items.map((it) => (
            <View key={it.id} style={s.tRow}>
              <Text style={[s.tText, s.c3]}>{it.productName}</Text>
              <Text style={[s.tText, s.colNum]}>{Number(it.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</Text>
              <Text style={[s.tText, s.colNum]}>{fmt(Number(it.unitPrice))}</Text>
              <Text style={[s.tTextBold, s.colNum]}>{fmt(Number(it.subtotal))}</Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Volume total</Text>
              <Text style={s.totalsValue}>{totalKg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</Text>
            </View>
            <View style={s.totalsSep}>
              <View style={s.totalFinal}>
                <Text style={s.totalFinalLabel}>TOTAL</Text>
                <Text style={s.totalFinalValue}>{fmt(Number(purchase.total))}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Observações */}
        {purchase.notes ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Observações</Text>
            <Text style={s.notesBox}>{purchase.notes}</Text>
          </View>
        ) : null}

        {/* Assinatura */}
        <View style={s.signature}>
          <Text style={s.signatureLine}>Assinatura do fornecedor</Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text>Obrigado pela preferência — {empresa.nomeFantasia}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3.2: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 3.3: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/components/recycling/PurchasePdf.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): PurchasePdf receipt component

A4 PDF with branded header, supplier + operator metadata, payment
method, itemized table, totals, optional notes, and a single
signature line for the supplier. Mirrors the OsPdf visual language.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `SalePdf` component

**Files:**
- Create: `apps/frontend/src/components/recycling/SalePdf.tsx`

- [ ] **Step 4.1: Create the component**

Create `apps/frontend/src/components/recycling/SalePdf.tsx` with EXACTLY this content:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { SaleDetail } from '../../services/recycling/sales.service';

export interface SalePdfProps {
  sale: SaleDetail;
  empresa: { nomeFantasia: string };
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDocument(doc: string | null, type: 'CPF' | 'CNPJ' | null): string | null {
  if (!doc) return null;
  if (type === 'CPF' && doc.length === 11) {
    return `CPF ${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if ((type === 'CNPJ' || !type) && doc.length === 14) {
    return `CNPJ ${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
}

const TEAL = '#348E91';
const PETROL = '#1C5052';
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
  headerRight: { textAlign: 'right', alignItems: 'flex-end' },
  kicker: {
    fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
  },
  docNumber: { fontSize: 14, fontFamily: 'Courier-Bold', color: FG, marginTop: 2 },
  docDate: { fontSize: 9, color: MUTED, marginTop: 1 },

  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
  },

  twoCol: { flexDirection: 'row', gap: 20 },
  col: { flex: 1 },
  label: {
    fontSize: 9, color: SUBTLE, marginBottom: 2, textTransform: 'uppercase',
    letterSpacing: 0.6, fontFamily: 'Helvetica-Bold',
  },
  value: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: FG },
  valueSub: { fontSize: 9, color: MUTED, marginTop: 1 },

  tHead: {
    flexDirection: 'row', backgroundColor: CAP_BG, padding: 6, paddingVertical: 5,
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
  c3: { flex: 3 },
  colNum: { flex: 1, textAlign: 'right' },

  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  totalsBox: { width: 260 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalsLabel: { fontSize: 10, color: MUTED },
  totalsValue: { fontSize: 10, color: FG },
  totalsSep: { borderTopWidth: 2, borderTopColor: PETROL, marginTop: 4, paddingTop: 8 },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between' },
  totalFinalLabel: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', color: PETROL, letterSpacing: 1,
  },
  totalFinalValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: PETROL },

  notesBox: {
    padding: 10, backgroundColor: CAP_BG, borderRadius: 4,
    fontSize: 10, color: FG, marginTop: 4,
  },

  signature: { marginTop: 50 },
  signatureLine: {
    borderTopWidth: 1, borderTopColor: FG, paddingTop: 5,
    textAlign: 'center', fontSize: 9, color: MUTED,
    width: 280, alignSelf: 'center',
  },

  footer: {
    marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER,
    textAlign: 'center', fontSize: 9, color: SUBTLE,
  },
});

export function SalePdf({ sale, empresa }: SalePdfProps) {
  const totalKg = sale.items.reduce((a, it) => a + Number(it.quantity), 0);
  const docNumber = `#${sale.id.slice(0, 8).toUpperCase()}`;
  const emittedDate = new Date(sale.soldAt).toLocaleDateString('pt-BR');
  const registeredAt = new Date(sale.soldAt).toLocaleString('pt-BR');
  const buyerDoc = formatDocument(sale.buyer.document, sale.buyer.documentType);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brandRow}>
            <Text style={s.tile}>P</Text>
            <Text style={s.brandName}>{empresa.nomeFantasia}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.kicker}>Comprovante de Venda</Text>
            <Text style={s.docNumber}>{docNumber}</Text>
            <Text style={s.docDate}>Emitida em {emittedDate}</Text>
          </View>
        </View>

        {/* Comprador e operador */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Comprador e operador</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={s.label}>Comprador</Text>
              <Text style={s.value}>{sale.buyer.name || '—'}</Text>
              {buyerDoc ? <Text style={s.valueSub}>{buyerDoc}</Text> : null}
            </View>
            <View style={s.col}>
              <Text style={s.label}>Operador</Text>
              <Text style={s.value}>{sale.operator.name || '—'}</Text>
              <Text style={s.valueSub}>Registrado em {registeredAt}</Text>
            </View>
          </View>
        </View>

        {/* Itens */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Itens</Text>
          <View style={s.tHead}>
            <Text style={[s.tHeadText, s.c3]}>Produto</Text>
            <Text style={[s.tHeadText, s.colNum]}>Qtd</Text>
            <Text style={[s.tHeadText, s.colNum]}>Preço/kg</Text>
            <Text style={[s.tHeadText, s.colNum]}>Subtotal</Text>
          </View>
          {sale.items.map((it) => (
            <View key={it.id} style={s.tRow}>
              <Text style={[s.tText, s.c3]}>{it.productName}</Text>
              <Text style={[s.tText, s.colNum]}>{Number(it.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</Text>
              <Text style={[s.tText, s.colNum]}>{fmt(Number(it.unitPrice))}</Text>
              <Text style={[s.tTextBold, s.colNum]}>{fmt(Number(it.subtotal))}</Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Volume total</Text>
              <Text style={s.totalsValue}>{totalKg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg</Text>
            </View>
            <View style={s.totalsSep}>
              <View style={s.totalFinal}>
                <Text style={s.totalFinalLabel}>TOTAL</Text>
                <Text style={s.totalFinalValue}>{fmt(Number(sale.total))}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Observações */}
        {sale.notes ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Observações</Text>
            <Text style={s.notesBox}>{sale.notes}</Text>
          </View>
        ) : null}

        {/* Assinatura */}
        <View style={s.signature}>
          <Text style={s.signatureLine}>Assinatura do comprador</Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text>Obrigado pela preferência — {empresa.nomeFantasia}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4.2: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 4.3: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/components/recycling/SalePdf.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/sales): SalePdf receipt component

Mirrors PurchasePdf's structure but uses buyer instead of supplier,
omits the payment method section (sales entity has no payment_method)
and ends with an 'Assinatura do comprador' signature line.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrate `Imprimir PDF` button in `PurchaseDetailModal`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx`

- [ ] **Step 5.1: Add imports at the top**

Edit `apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx`. The current import block starts with:

```tsx
import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react';
import { purchasesService, type PurchaseDetail } from '../../../services/recycling/purchases.service';
import { PaymentBadge } from '../../../components/recycling/PaymentBadge';
```

Add these three lines at the end of the import block (after `PaymentBadge`):

```tsx
import { PurchasePdf } from '../../../components/recycling/PurchasePdf';
import { downloadPdf } from '../../../utils/downloadPdf';
import { companyService } from '../../../services/company.service';
```

- [ ] **Step 5.2: Add print state + handler inside the component**

Inside the `PurchaseDetailModal` component, directly below the existing `useState` declarations (`detail`, `loading`, `error`), add:

```tsx
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!detail) return;
    setPrinting(true);
    setError(null);
    try {
      let nomeFantasia = 'Praktikus';
      try {
        const company = await companyService.getProfile();
        nomeFantasia = company.nomeFantasia;
      } catch {
        /* fallback to 'Praktikus' */
      }
      await downloadPdf(
        <PurchasePdf purchase={detail} empresa={{ nomeFantasia }} />,
        `Compra-${detail.id.slice(0, 8).toUpperCase()}.pdf`,
      );
    } catch {
      setError('Erro ao gerar PDF.');
    } finally {
      setPrinting(false);
    }
  };
```

- [ ] **Step 5.3: Replace the modal footer**

Find the `<CModalFooter>` block at the bottom of the JSX — it currently contains only the `Fechar` button:

```tsx
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>Fechar</CButton>
      </CModalFooter>
```

Replace it with:

```tsx
      <CModalFooter>
        <CButton
          color="primary"
          variant="outline"
          onClick={handlePrint}
          disabled={!detail || printing}
          style={{ marginRight: 'auto', minWidth: 130 }}
        >
          {printing ? <CSpinner size="sm" /> : 'Imprimir PDF'}
        </CButton>
        <CButton color="secondary" variant="outline" onClick={onClose}>Fechar</CButton>
      </CModalFooter>
```

- [ ] **Step 5.4: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 5.5: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/pages/recycling/purchases/PurchaseDetailModal.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): Imprimir PDF button in detail modal

Adds an outline-primary 'Imprimir PDF' button in the footer, left
of Fechar. Uses the already-loaded PurchaseDetail plus a live
companyService.getProfile() fetch (with fallback to 'Praktikus').
Errors surface via the existing CAlert in the modal body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Integrate `Imprimir PDF` button in `SaleDetailModal`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx`

- [ ] **Step 6.1: Add imports at the top**

Edit `apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx`. The current imports block ends with:

```tsx
import { salesService, type SaleDetail } from '../../../services/recycling/sales.service';
```

Add these three lines after it:

```tsx
import { SalePdf } from '../../../components/recycling/SalePdf';
import { downloadPdf } from '../../../utils/downloadPdf';
import { companyService } from '../../../services/company.service';
```

- [ ] **Step 6.2: Add print state + handler inside the component**

Inside the `SaleDetailModal` component, directly below the existing `useState` declarations (`detail`, `loading`, `error`), add:

```tsx
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (!detail) return;
    setPrinting(true);
    setError(null);
    try {
      let nomeFantasia = 'Praktikus';
      try {
        const company = await companyService.getProfile();
        nomeFantasia = company.nomeFantasia;
      } catch {
        /* fallback to 'Praktikus' */
      }
      await downloadPdf(
        <SalePdf sale={detail} empresa={{ nomeFantasia }} />,
        `Venda-${detail.id.slice(0, 8).toUpperCase()}.pdf`,
      );
    } catch {
      setError('Erro ao gerar PDF.');
    } finally {
      setPrinting(false);
    }
  };
```

- [ ] **Step 6.3: Replace the modal footer**

Find the `<CModalFooter>` block and replace it with:

```tsx
      <CModalFooter>
        <CButton
          color="primary"
          variant="outline"
          onClick={handlePrint}
          disabled={!detail || printing}
          style={{ marginRight: 'auto', minWidth: 130 }}
        >
          {printing ? <CSpinner size="sm" /> : 'Imprimir PDF'}
        </CButton>
        <CButton color="secondary" variant="outline" onClick={onClose}>Fechar</CButton>
      </CModalFooter>
```

- [ ] **Step 6.4: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 6.5: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/pages/recycling/sales/SaleDetailModal.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/sales): Imprimir PDF button in detail modal

Mirrors PurchaseDetailModal: outline-primary button in the footer,
calls companyService.getProfile() at click time with fallback, uses
the already-loaded SaleDetail for PDF content.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Integrate `PrintPromptModal` in `NewPurchasePage`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`

- [ ] **Step 7.1: Add imports**

Edit `apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx`. Find the existing import of `purchasesService`:

```tsx
import { purchasesService, PaymentMethod } from '../../../services/recycling/purchases.service';
```

(The exact line should export `PaymentMethod` too — keep whatever the current form is.) Add these four lines after it:

```tsx
import { PrintPromptModal } from '../../../components/PrintPromptModal';
import { PurchasePdf } from '../../../components/recycling/PurchasePdf';
import { downloadPdf } from '../../../utils/downloadPdf';
import { companyService } from '../../../services/company.service';
```

- [ ] **Step 7.2: Add print-prompt state**

Inside the `NewPurchasePage` component (just below the existing state like `submitError`, `loadingData`, etc.), add:

```tsx
  const [newPurchaseId, setNewPurchaseId] = useState<string | null>(null);
```

- [ ] **Step 7.3: Rewrite `onSubmit` to set the id instead of navigating**

Find the existing `onSubmit` function. The current body is:

```tsx
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await purchasesService.create({
        supplierId: data.supplierId,
        paymentMethod: data.paymentMethod,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: data.notes || undefined,
      });
      navigate('/recycling/purchases');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao registrar compra.'));
    }
  };
```

Replace it with:

```tsx
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      const created = await purchasesService.create({
        supplierId: data.supplierId,
        paymentMethod: data.paymentMethod,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: data.notes || undefined,
      });
      setNewPurchaseId(created.id);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao registrar compra.'));
    }
  };
```

- [ ] **Step 7.4: Add print handler + close handler**

Add these two functions right below `onSubmit`:

```tsx
  const handlePrintNewPurchase = async () => {
    if (!newPurchaseId) return;
    const [detail, company] = await Promise.all([
      purchasesService.getById(newPurchaseId),
      companyService.getProfile().catch(() => ({ nomeFantasia: 'Praktikus' })),
    ]);
    await downloadPdf(
      <PurchasePdf purchase={detail} empresa={{ nomeFantasia: company.nomeFantasia }} />,
      `Compra-${detail.id.slice(0, 8).toUpperCase()}.pdf`,
    );
    navigate('/recycling/purchases');
  };

  const handleClosePrompt = () => {
    setNewPurchaseId(null);
    navigate('/recycling/purchases');
  };
```

- [ ] **Step 7.5: Render the prompt modal**

Find the final closing `</div>` of the page's root JSX (at the end of the `return (...)`). Directly before that final `</div>`, add:

```tsx
      <PrintPromptModal
        open={newPurchaseId !== null}
        title="Compra registrada"
        message="Deseja imprimir o comprovante?"
        onPrint={handlePrintNewPurchase}
        onClose={handleClosePrompt}
      />
```

- [ ] **Step 7.6: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 7.7: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/pages/recycling/purchases/NewPurchasePage.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/purchases): post-create print prompt on NewPurchasePage

After create() succeeds, the page shows PrintPromptModal instead of
navigating directly. Imprimir fetches getById + company profile,
generates the PDF and then navigates. Fechar navigates immediately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integrate `PrintPromptModal` in `NewSalePage`

**Files:**
- Modify: `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`

- [ ] **Step 8.1: Add imports**

Edit `apps/frontend/src/pages/recycling/sales/NewSalePage.tsx`. Find the existing import of `salesService`:

```tsx
import { salesService } from '../../../services/recycling/sales.service';
```

Add these four lines after it:

```tsx
import { PrintPromptModal } from '../../../components/PrintPromptModal';
import { SalePdf } from '../../../components/recycling/SalePdf';
import { downloadPdf } from '../../../utils/downloadPdf';
import { companyService } from '../../../services/company.service';
```

- [ ] **Step 8.2: Add print-prompt state**

Inside the `NewSalePage` component, just below the existing state declarations, add:

```tsx
  const [newSaleId, setNewSaleId] = useState<string | null>(null);
```

- [ ] **Step 8.3: Rewrite `onSubmit` to set the id instead of navigating**

Find the existing `onSubmit`. Its current body is:

```tsx
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await salesService.create({
        buyerId: data.buyerId,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: data.notes || undefined,
      });
      navigate('/recycling/sales');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao registrar venda.'));
    }
  };
```

Replace it with:

```tsx
  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      const created = await salesService.create({
        buyerId: data.buyerId,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: data.notes || undefined,
      });
      setNewSaleId(created.id);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao registrar venda.'));
    }
  };
```

- [ ] **Step 8.4: Add print handler + close handler**

Add these two functions right below `onSubmit`:

```tsx
  const handlePrintNewSale = async () => {
    if (!newSaleId) return;
    const [detail, company] = await Promise.all([
      salesService.getById(newSaleId),
      companyService.getProfile().catch(() => ({ nomeFantasia: 'Praktikus' })),
    ]);
    await downloadPdf(
      <SalePdf sale={detail} empresa={{ nomeFantasia: company.nomeFantasia }} />,
      `Venda-${detail.id.slice(0, 8).toUpperCase()}.pdf`,
    );
    navigate('/recycling/sales');
  };

  const handleClosePrompt = () => {
    setNewSaleId(null);
    navigate('/recycling/sales');
  };
```

- [ ] **Step 8.5: Render the prompt modal**

Find the final closing `</div>` of the page's root JSX. Directly before that final `</div>`, add:

```tsx
      <PrintPromptModal
        open={newSaleId !== null}
        title="Venda registrada"
        message="Deseja imprimir o comprovante?"
        onPrint={handlePrintNewSale}
        onClose={handleClosePrompt}
      />
```

- [ ] **Step 8.6: Type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Step 8.7: Commit**

```bash
cd /home/vinicius/Projetos/vinicius/praktikus && git add apps/frontend/src/pages/recycling/sales/NewSalePage.tsx && git commit --no-gpg-sign -m "$(cat <<'EOF'
feat(recycling/sales): post-create print prompt on NewSalePage

Mirrors NewPurchasePage: on successful create() the page renders
PrintPromptModal. Imprimir fetches getById + company profile, runs
downloadPdf, then navigates. Fechar navigates directly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final checks

- [ ] **Full frontend type-check**

Run: `npx --prefix /home/vinicius/Projetos/vinicius/praktikus/apps/frontend tsc -p /home/vinicius/Projetos/vinicius/praktikus/apps/frontend --noEmit`
Expected: exit 0.

- [ ] **Full frontend test suite** (no new tests; just make sure nothing pre-existing broke)

Run: `pnpm --filter frontend test`
Expected: all green.

- [ ] **Full backend test suite** (should be untouched, but verifying parity)

Run: `pnpm --filter backend test`
Expected: all green — no backend changes in this plan.

- [ ] **Lint pass**

Run: `pnpm lint`
Expected: clean or only pre-existing warnings.

- [ ] **Commit-log review**

Run: `git log --oneline main..HEAD`
Expected: the 8 task commits plus the spec commit (`06a36b6`) are present, in order.
