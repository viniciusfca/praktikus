import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ServiceOrderDetail } from '../services/service-orders.service';

export interface OsPdfProps {
  so: ServiceOrderDetail;
  empresa: { nomeFantasia: string };
  cliente: { nome: string; cpfCnpj: string };
  veiculo: { placa: string; marca: string; modelo: string; ano: number };
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Palette ─────────────────────────────────────────────────────────────────
const TEAL = '#348E91';
const PETROL = '#1C5052';
const FG = '#0F1414';
const MUTED = '#5A6464';
const SUBTLE = '#8A9393';
const BORDER = '#E4E7E7';
const BORDER_SOFT = '#EEF0F0';
const CAP_BG = '#F7F8F8';

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: FG,
    lineHeight: 1.4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 16,
    marginBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: TEAL,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingTop: 3,
  },
  brandName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: FG,
  },
  headerMeta: {
    fontSize: 9,
    color: MUTED,
    marginTop: 6,
    lineHeight: 1.35,
  },
  headerRight: {
    textAlign: 'right',
    alignItems: 'flex-end',
  },
  kicker: {
    fontSize: 9,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: 'Helvetica-Bold',
  },
  osNumber: {
    fontSize: 14,
    fontFamily: 'Courier-Bold',
    color: FG,
    marginTop: 2,
  },
  osDate: {
    fontSize: 9,
    color: MUTED,
    marginTop: 1,
  },

  // Section
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  // Data rows
  twoCol: {
    flexDirection: 'row',
    gap: 20,
  },
  col: { flex: 1 },
  label: {
    fontSize: 9,
    color: SUBTLE,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'Helvetica-Bold',
  },
  value: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: FG,
  },
  valueSub: {
    fontSize: 9,
    color: MUTED,
    marginTop: 1,
  },

  // Checklist row
  cklRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cklLabel: {
    width: 90,
    color: MUTED,
    fontSize: 10,
  },
  cklValue: {
    flex: 1,
    color: FG,
    fontSize: 10,
  },

  // Tables
  tHead: {
    flexDirection: 'row',
    backgroundColor: CAP_BG,
    padding: 6,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  tHeadText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tRow: {
    flexDirection: 'row',
    padding: 6,
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_SOFT,
  },
  tText: {
    fontSize: 10,
    color: FG,
  },
  tTextBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: FG,
  },
  tTextMuted: {
    fontSize: 9,
    color: MUTED,
    marginTop: 1,
  },

  c3: { flex: 3 },
  c1: { flex: 1, textAlign: 'right' },
  colNum: { flex: 1, textAlign: 'right' },

  // Totals
  totalsWrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  totalsBox: {
    width: 260,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  totalsLabel: {
    fontSize: 10,
    color: MUTED,
  },
  totalsValue: {
    fontSize: 10,
    color: FG,
  },
  totalsSep: {
    borderTopWidth: 2,
    borderTopColor: PETROL,
    marginTop: 4,
    paddingTop: 8,
  },
  totalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalFinalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PETROL,
    letterSpacing: 1,
  },
  totalFinalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: PETROL,
  },

  // Signatures
  signatures: {
    flexDirection: 'row',
    gap: 30,
    marginTop: 50,
  },
  signatureSlot: {
    flex: 1,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: FG,
    paddingTop: 5,
    textAlign: 'center',
    fontSize: 9,
    color: MUTED,
  },

  // Footer
  footer: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    textAlign: 'center',
    fontSize: 9,
    color: SUBTLE,
  },
});

export function OsPdf({ so, empresa, cliente, veiculo }: OsPdfProps) {
  const totalServices = so.itemsServices.reduce((a, item) => a + Number(item.valor), 0);
  const totalParts = so.itemsParts.reduce(
    (a, item) => a + Number(item.valorUnitario) * Number(item.quantidade),
    0,
  );
  const total = totalServices + totalParts;

  const osNumber = `#OS-${so.id.slice(0, 8).toUpperCase()}`;
  const createdAt = new Date(so.createdAt).toLocaleDateString('pt-BR');
  const hasChecklist = so.kmEntrada || so.combustivel || so.observacoesEntrada;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <View style={s.brandRow}>
              <Text style={s.tile}>P</Text>
              <Text style={s.brandName}>{empresa.nomeFantasia}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.kicker}>Ordem de Serviço</Text>
            <Text style={s.osNumber}>{osNumber}</Text>
            <Text style={s.osDate}>Emitida em {createdAt}</Text>
          </View>
        </View>

        {/* ── Cliente e veículo ───────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Cliente e veículo</Text>
          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={s.label}>Cliente</Text>
              <Text style={s.value}>{cliente.nome}</Text>
              <Text style={s.valueSub}>CPF/CNPJ: {cliente.cpfCnpj}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Veículo</Text>
              <Text style={s.value}>{veiculo.marca} {veiculo.modelo}</Text>
              <Text style={s.valueSub}>Placa {veiculo.placa} · Ano {veiculo.ano}</Text>
            </View>
          </View>
        </View>

        {/* ── Checklist ───────────────────────────────────────────── */}
        {hasChecklist && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Checklist de entrada</Text>
            {so.kmEntrada ? (
              <View style={s.cklRow}>
                <Text style={s.cklLabel}>KM:</Text>
                <Text style={s.cklValue}>{so.kmEntrada}</Text>
              </View>
            ) : null}
            {so.combustivel ? (
              <View style={s.cklRow}>
                <Text style={s.cklLabel}>Combustível:</Text>
                <Text style={s.cklValue}>{so.combustivel}</Text>
              </View>
            ) : null}
            {so.observacoesEntrada ? (
              <View style={s.cklRow}>
                <Text style={s.cklLabel}>Observações:</Text>
                <Text style={s.cklValue}>{so.observacoesEntrada}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Serviços ────────────────────────────────────────────── */}
        {so.itemsServices.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Serviços</Text>
            <View style={s.tHead}>
              <Text style={[s.tHeadText, s.c3]}>Descrição</Text>
              <Text style={[s.tHeadText, s.c1]}>Valor</Text>
            </View>
            {so.itemsServices.map((item) => (
              <View key={item.id} style={s.tRow}>
                <Text style={[s.tText, s.c3]}>{item.nomeServico}</Text>
                <Text style={[s.tTextBold, s.c1]}>{fmt(Number(item.valor))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Peças ───────────────────────────────────────────────── */}
        {so.itemsParts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Peças</Text>
            <View style={s.tHead}>
              <Text style={[s.tHeadText, s.c3]}>Descrição</Text>
              <Text style={[s.tHeadText, s.colNum]}>Qtd</Text>
              <Text style={[s.tHeadText, s.colNum]}>Val. unit.</Text>
              <Text style={[s.tHeadText, s.colNum]}>Subtotal</Text>
            </View>
            {so.itemsParts.map((item) => (
              <View key={item.id} style={s.tRow}>
                <Text style={[s.tText, s.c3]}>{item.nomePeca}</Text>
                <Text style={[s.tText, s.colNum]}>{item.quantidade}</Text>
                <Text style={[s.tText, s.colNum]}>{fmt(Number(item.valorUnitario))}</Text>
                <Text style={[s.tTextBold, s.colNum]}>
                  {fmt(Number(item.valorUnitario) * Number(item.quantidade))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Totais ──────────────────────────────────────────────── */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Total serviços</Text>
              <Text style={s.totalsValue}>{fmt(totalServices)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Total peças</Text>
              <Text style={s.totalsValue}>{fmt(totalParts)}</Text>
            </View>
            <View style={s.totalsSep}>
              <View style={s.totalFinal}>
                <Text style={s.totalFinalLabel}>TOTAL GERAL</Text>
                <Text style={s.totalFinalValue}>{fmt(total)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Assinaturas ─────────────────────────────────────────── */}
        <View style={s.signatures}>
          <View style={s.signatureSlot}>
            <Text style={s.signatureLine}>Assinatura do cliente</Text>
          </View>
          <View style={s.signatureSlot}>
            <Text style={s.signatureLine}>Assinatura responsável técnico</Text>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text>Obrigado pela preferência — {empresa.nomeFantasia}</Text>
        </View>
      </Page>
    </Document>
  );
}
