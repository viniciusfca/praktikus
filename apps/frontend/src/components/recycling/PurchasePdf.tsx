import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseDetail } from '../../services/recycling/purchases.service';
import { formatDocumentWithType } from '../../utils/formatDocument';

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
  const supplierDoc = formatDocumentWithType(purchase.supplier.document, purchase.supplier.documentType);
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
