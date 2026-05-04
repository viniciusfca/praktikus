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
  table: { name: string };
  layout: 'full' | 'compact';
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

  tableName: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  footer: {
    marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER,
    fontSize: 9, color: SUBTLE,
  },
  footerLine: { textAlign: 'center', marginBottom: 4 },
});

export function PriceListPdf({ rows, empresa, printedAt, table, layout }: Readonly<PriceListPdfProps>) {
  const cnpjFormatted = empresa.cnpj ? formatCnpj(empresa.cnpj) : '';
  const isFull = layout === 'full';

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
            <Text style={s.tableName}>{table.name}</Text>
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
            {isFull && <Text style={[s.tHeadText, s.colUnit]}>Un.</Text>}
            <Text style={[s.tHeadText, s.colPrice]}>{isFull ? 'Preço por unidade' : 'Preço'}</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={s.tRow}>
              <Text style={[s.tText, s.colName]}>{row.name}</Text>
              {isFull && <Text style={[s.tText, s.colUnit]}>{row.unitSymbol}</Text>}
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
