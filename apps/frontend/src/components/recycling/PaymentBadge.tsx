const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CASH: { label: 'Dinheiro', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
  PIX: { label: 'PIX', color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.12)' },
  CARD: { label: 'Cartão', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

export function PaymentBadge({ method }: { method: string }) {
  const c = PAYMENT_CONFIG[method] ?? PAYMENT_CONFIG.CARD;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}
