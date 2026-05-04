import { CFormInput } from '@coreui/react';

export interface PriceRowProps {
  index: number;
  name: string;
  description: string | null;
  unitSymbol: string;
  required: boolean;
  value: number | string | null | undefined;
  onChange: (value: string) => void;
  error?: string;
}

export function PriceRow({
  index,
  name,
  description,
  unitSymbol,
  required,
  value,
  onChange,
  error,
}: PriceRowProps) {
  const filled = value !== '' && value !== null && value !== undefined;
  return (
    <div
      data-filled={filled}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 160px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1px solid ${filled ? 'var(--cui-primary)' : 'var(--cui-border-color)'}`,
        borderRadius: 6,
        background: filled
          ? 'var(--cui-primary-bg-subtle, rgba(50,108,114,0.08))'
          : 'var(--cui-body-bg)',
        transition: 'border-color 150ms, background 150ms',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: filled ? 'var(--cui-primary)' : 'var(--cui-tertiary-bg)',
          color: filled ? '#fff' : 'var(--cui-secondary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {index}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 540, lineHeight: 1.2 }}>
          {name}
          {required && (
            <span
              style={{ color: 'var(--cui-danger, #b34244)', marginLeft: 4 }}
            >
              *
            </span>
          )}
        </span>
        {description && (
          <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
            {description}
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: 'var(--cui-secondary-color)',
            pointerEvents: 'none',
            fontWeight: 500,
          }}
        >
          R$
        </span>
        <CFormInput
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0,00"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!error}
          style={{
            paddingLeft: 36,
            paddingRight: 44,
            textAlign: 'right',
            fontFeatureSettings: "'tnum'",
            fontWeight: 540,
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: 'var(--cui-secondary-color)',
            pointerEvents: 'none',
          }}
        >
          /{unitSymbol}
        </span>
      </div>

      {error && (
        <span
          style={{
            gridColumn: '1 / -1',
            fontSize: 12,
            color: 'var(--cui-danger, #b34244)',
            marginTop: -4,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
