import type { OpenInvoice } from '../../services/billing.service';

const METHOD_LABEL: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão',
  BOLETO: 'Boleto',
  UNDEFINED: '—',
};

export function InvoiceHistoryTable({ invoices }: { invoices: OpenInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div style={{ padding: 18, color: '#5b6868', textAlign: 'center' }}>
        Nenhuma fatura paga ainda.
      </div>
    );
  }
  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ textAlign: 'left', color: '#5b6868', fontSize: 12, textTransform: 'uppercase' }}>
          <th style={{ padding: '8px 0' }}>Data</th>
          <th style={{ padding: '8px 0' }}>Valor</th>
          <th style={{ padding: '8px 0' }}>Método</th>
          <th style={{ padding: '8px 0' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} style={{ borderTop: '1px solid #e3e7e7' }}>
            <td style={{ padding: '10px 0' }}>{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
            <td style={{ padding: '10px 0', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(inv.value)}</td>
            <td style={{ padding: '10px 0' }}>{METHOD_LABEL[inv.billingType] ?? inv.billingType}</td>
            <td style={{ padding: '10px 0', color: inv.status === 'CONFIRMED' ? '#15803d' : '#5b6868' }}>
              {inv.status === 'CONFIRMED' ? 'Pago' : inv.status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
