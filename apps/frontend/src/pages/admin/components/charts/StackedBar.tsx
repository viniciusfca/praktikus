interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  height?: number;
}

export function StackedBar({ segments, height = 14 }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div
        style={{
          height,
          background: 'var(--adm-bg-muted)',
          borderRadius: height / 2,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        background: 'var(--adm-bg-muted)',
      }}
    >
      {segments.map((s) => (
        <div
          key={s.label}
          title={`${s.label}: ${s.value} (${((s.value / total) * 100).toFixed(0)}%)`}
          style={{
            flex: s.value,
            background: s.color,
          }}
        />
      ))}
    </div>
  );
}
