interface LogoProps {
  variant?: 'full' | 'icon';
  size?: number;
  className?: string;
}

export function Logo({ variant = 'full', size = 28, className = '' }: LogoProps) {
  const fontSize = Math.round(size * 0.55);

  const tile = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        background: 'var(--cui-primary)',
        color: '#fff',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize,
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      P
    </span>
  );

  if (variant === 'icon') {
    return (
      <span className={className} aria-label="Praktikus" role="img">
        {tile}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.32) }}
    >
      {tile}
      <span
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: Math.round(size * 0.64),
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'inherit',
          lineHeight: 1,
        }}
      >
        Praktikus
      </span>
    </span>
  );
}
