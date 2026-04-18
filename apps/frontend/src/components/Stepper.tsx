interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 24px' }}>
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: i === steps.length - 1 ? '0' : '1' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div
                aria-hidden
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: done
                    ? 'rgba(52,142,145,0.15)'
                    : active
                      ? 'var(--cui-primary)'
                      : 'var(--cui-secondary-bg, #f4f5f5)',
                  color: done
                    ? 'var(--cui-primary)'
                    : active
                      ? '#fff'
                      : 'var(--cui-secondary-color)',
                  border: done || active ? 'none' : '1px solid var(--cui-border-color)',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active || done ? 'var(--cui-body-color)' : 'var(--cui-secondary-color)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: done ? 'var(--cui-primary)' : 'var(--cui-border-color)',
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
