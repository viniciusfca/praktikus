import { useState } from 'react';

interface UfDatum {
  uf: string;
  count: number;
}

interface Props {
  data: UfDatum[];
}

const UF_COORDS: Record<
  string,
  { c: number; r: number; name: string; mini?: boolean }
> = {
  RR: { c: 2, r: 0, name: 'Roraima' },
  AP: { c: 4, r: 0, name: 'Amapá' },
  AM: { c: 1, r: 1, name: 'Amazonas' },
  PA: { c: 3, r: 1, name: 'Pará' },
  AC: { c: 0, r: 2, name: 'Acre' },
  RO: { c: 1, r: 2, name: 'Rondônia' },
  MA: { c: 4, r: 1, name: 'Maranhão' },
  CE: { c: 5, r: 1, name: 'Ceará' },
  RN: { c: 6, r: 1, name: 'Rio G. Norte' },
  PI: { c: 4, r: 2, name: 'Piauí' },
  PB: { c: 6, r: 2, name: 'Paraíba' },
  PE: { c: 5, r: 2, name: 'Pernambuco' },
  AL: { c: 6, r: 3, name: 'Alagoas' },
  SE: { c: 5, r: 3, name: 'Sergipe' },
  BA: { c: 4, r: 3, name: 'Bahia' },
  MT: { c: 2, r: 2, name: 'Mato Grosso' },
  TO: { c: 3, r: 2, name: 'Tocantins' },
  GO: { c: 3, r: 3, name: 'Goiás' },
  DF: { c: 4, r: 3.0, name: 'Distrito Federal', mini: true },
  MS: { c: 2, r: 3, name: 'Mato G. do Sul' },
  MG: { c: 3, r: 4, name: 'Minas Gerais' },
  ES: { c: 4, r: 4, name: 'Espírito Santo' },
  SP: { c: 2, r: 4, name: 'São Paulo' },
  RJ: { c: 3, r: 5, name: 'Rio de Janeiro' },
  PR: { c: 2, r: 5, name: 'Paraná' },
  SC: { c: 2, r: 6, name: 'Santa Catarina' },
  RS: { c: 1, r: 7, name: 'Rio G. do Sul' },
};

const TILE = 64;
const GAP = 6;

function colorFor(ratio: number): string {
  if (ratio === 0) return 'var(--adm-bg-subtle)';
  if (ratio <= 0.1) return 'var(--brand-100)';
  if (ratio <= 0.33) return 'var(--brand-300)';
  if (ratio <= 0.66) return 'var(--brand-500)';
  return 'var(--brand-700)';
}

export function BrazilTilemap({ data }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const counts: Record<string, number> = {};
  Object.keys(UF_COORDS).forEach((uf) => (counts[uf] = 0));
  data.forEach((d) => {
    if (counts[d.uf] !== undefined) counts[d.uf] = d.count;
  });

  const max = Math.max(...Object.values(counts), 1);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const cols = 7;
  const rows = 8;
  const width = cols * TILE + (cols - 1) * GAP;
  const height = rows * TILE + (rows - 1) * GAP;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Distribuição de clientes por UF"
      >
        {Object.entries(UF_COORDS).map(([uf, pos]) => {
          const x = pos.c * (TILE + GAP);
          const y = pos.r * (TILE + GAP);
          const ratio = counts[uf] / max;
          const fill = colorFor(ratio);
          const isMini = pos.mini;
          const w = isMini ? 22 : TILE;
          const h = isMini ? 22 : TILE;
          const offset = isMini ? TILE - 22 - 2 : 0;
          return (
            <g
              key={uf}
              onMouseEnter={() => setHover(uf)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x + offset}
                y={y + offset}
                width={w}
                height={h}
                rx={6}
                fill={fill}
                stroke={hover === uf ? 'var(--adm-accent)' : 'var(--adm-border)'}
                strokeWidth={hover === uf ? 2 : 1}
              />
              <text
                x={x + offset + w / 2}
                y={y + offset + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isMini ? 9 : 11}
                fontWeight={600}
                fill={ratio > 0.5 ? '#fff' : 'var(--adm-fg)'}
              >
                {uf}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'var(--adm-surface)',
            border: '1px solid var(--adm-border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            boxShadow: 'var(--adm-shadow-md)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {hover} — {UF_COORDS[hover].name}
          </div>
          <div style={{ color: 'var(--adm-fg-muted)' }}>
            {counts[hover]} cliente(s){' '}
            {total > 0 && (
              <>· {((counts[hover] / total) * 100).toFixed(1)}% da base</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
