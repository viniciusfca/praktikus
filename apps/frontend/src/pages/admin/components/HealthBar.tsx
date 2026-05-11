interface Props {
  /** 0..100 ou null — null mostra "sem dado" */
  score: number | null | undefined;
}

function colorFor(s: number): string {
  if (s >= 80) return 'var(--adm-success)';
  if (s >= 50) return 'var(--adm-warning)';
  return 'var(--adm-danger)';
}

export function HealthBar({ score }: Props) {
  if (score == null) {
    return (
      <div
        className="adm-healthbar adm-healthbar--null"
        title="Disponível na Fase 1.5"
      >
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'var(--adm-bg-muted)',
            borderRadius: 3,
          }}
        />
        <small
          style={{
            display: 'block',
            color: 'var(--adm-fg-subtle)',
            fontSize: 10,
            marginTop: 2,
          }}
        >
          Sem dado
        </small>
      </div>
    );
  }
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="adm-healthbar" title={`Score ${clamped}/100`}>
      <div
        style={{
          width: '100%',
          height: 6,
          background: 'var(--adm-bg-muted)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: colorFor(clamped),
            borderRadius: 3,
            transition: 'width .2s ease',
          }}
        />
      </div>
    </div>
  );
}
