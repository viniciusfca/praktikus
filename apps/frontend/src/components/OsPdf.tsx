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

const s = StyleSheet.create({
  page:        { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  title:       { fontSize: 16, fontWeight: 'bold' },
  sub:         { color: '#555' },
  section:     { marginBottom: 12 },
  sectionHead: { fontSize: 11, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 4, marginBottom: 6 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tHead:       { flexDirection: 'row', backgroundColor: '#f0f0f0', padding: 4, marginBottom: 2 },
  tRow:        { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  c3:          { flex: 3 },
  c1r:         { flex: 1, textAlign: 'right' },
  signature:   { marginTop: 48, borderTopWidth: 1, borderTopColor: '#333', width: 220, paddingTop: 4, color: '#555' },
});

export function OsPdf({ so, empresa, cliente, veiculo }: OsPdfProps) {
  const totalServices = so.itemsServices.reduce((a, item) => a + Number(item.valor), 0);
  const totalParts = so.itemsParts.reduce(
    (a, item) => a + Number(item.valorUnitario) * Number(item.quantidade),
    0,
  );
  const total = totalServices + totalParts;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header}>
          <Text style={s.title}>{empresa.nomeFantasia}</Text>
          <View>
            <Text>OS #{so.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={s.sub}>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</Text>
          </View>
        </View>

        {/* Cliente e Veículo */}
        <View style={s.section}>
          <Text style={s.sectionHead}>Cliente e Veículo</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>Cliente</Text>
              <Text>{cliente.nome}</Text>
              <Text style={s.sub}>{cliente.cpfCnpj}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>Veículo</Text>
              <Text>{veiculo.placa} — {veiculo.marca} {veiculo.modelo}</Text>
              <Text style={s.sub}>Ano: {veiculo.ano}</Text>
            </View>
          </View>
        </View>

        {/* Checklist de Entrada */}
        {(so.kmEntrada || so.combustivel || so.observacoesEntrada) && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Checklist de Entrada</Text>
            {so.kmEntrada && (
              <View style={s.row}>
                <Text style={s.sub}>KM:</Text>
                <Text>{so.kmEntrada}</Text>
              </View>
            )}
            {so.combustivel && (
              <View style={s.row}>
                <Text style={s.sub}>Combustível:</Text>
                <Text>{so.combustivel}</Text>
              </View>
            )}
            {so.observacoesEntrada && (
              <View style={s.row}>
                <Text style={s.sub}>Observações:</Text>
                <Text>{so.observacoesEntrada}</Text>
              </View>
            )}
          </View>
        )}

        {/* Serviços */}
        {so.itemsServices.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Serviços</Text>
            <View style={s.tHead}>
              <Text style={s.c3}>Descrição</Text>
              <Text style={s.c1r}>Valor</Text>
            </View>
            {so.itemsServices.map((item) => (
              <View key={item.id} style={s.tRow}>
                <Text style={s.c3}>{item.nomeServico}</Text>
                <Text style={s.c1r}>{fmt(Number(item.valor))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Peças */}
        {so.itemsParts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHead}>Peças</Text>
            <View style={s.tHead}>
              <Text style={s.c3}>Descrição</Text>
              <Text style={s.c1r}>Qtd</Text>
              <Text style={s.c1r}>Val. Unit.</Text>
              <Text style={s.c1r}>Subtotal</Text>
            </View>
            {so.itemsParts.map((item) => (
              <View key={item.id} style={s.tRow}>
                <Text style={s.c3}>{item.nomePeca}</Text>
                <Text style={s.c1r}>{item.quantidade}</Text>
                <Text style={s.c1r}>{fmt(Number(item.valorUnitario))}</Text>
                <Text style={s.c1r}>{fmt(Number(item.valorUnitario) * Number(item.quantidade))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totais */}
        <View style={[s.section, { alignItems: 'flex-end' }]}>
          <View style={s.row}>
            <Text style={[s.sub, { marginRight: 16 }]}>Total Serviços:</Text>
            <Text>{fmt(totalServices)}</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.sub, { marginRight: 16 }]}>Total Peças:</Text>
            <Text>{fmt(totalParts)}</Text>
          </View>
          <View style={[s.row, { marginTop: 4 }]}>
            <Text style={{ fontWeight: 'bold', marginRight: 16 }}>TOTAL GERAL:</Text>
            <Text style={{ fontWeight: 'bold' }}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Assinatura */}
        <View style={s.signature}>
          <Text>Assinatura do Cliente</Text>
        </View>

      </Page>
    </Document>
  );
}
