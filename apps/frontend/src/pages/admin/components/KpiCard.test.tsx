import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('mostra "—" e oculta sparkline quando value=null', () => {
    const { container } = render(
      <KpiCard label="MRR" value={null} sparkline={[1, 2, 3]} />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    // SparklineSvg não renderiza polyline; em vez disso tem skeleton
    expect(container.querySelector('polyline')).not.toBeInTheDocument();
    expect(container.querySelector('.adm-skeleton')).toBeInTheDocument();
  });

  it('renderiza valor formatado e sparkline quando value não é null', () => {
    const { container } = render(
      <KpiCard
        label="MRR"
        value={1234.5}
        formatValue={(v) => `R$ ${(v as number).toFixed(2)}`}
        sparkline={[1, 2, 3, 4]}
      />,
    );
    expect(screen.getByText('R$ 1234.50')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeInTheDocument();
  });

  it('mostra delta com cor success se positivo', () => {
    const { container } = render(
      <KpiCard label="x" value={10} delta={5} />,
    );
    const deltaEl = container.querySelector(
      'div[style*="success"]',
    ) as HTMLElement;
    expect(deltaEl?.textContent).toMatch(/\+5/);
  });
});
