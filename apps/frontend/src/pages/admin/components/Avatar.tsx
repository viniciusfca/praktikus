import { initialsOf } from '../lib/format';

interface Props {
  name: string;
  size?: number;
  color?: string;
}

export function Avatar({ name, size = 32, color = 'var(--adm-accent)' }: Props) {
  const inits = initialsOf(name);
  return (
    <span
      className="adm-avatar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: color,
        color: 'var(--adm-accent-fg)',
        borderRadius: '50%',
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
      }}
      aria-label={name}
    >
      {inits}
    </span>
  );
}
