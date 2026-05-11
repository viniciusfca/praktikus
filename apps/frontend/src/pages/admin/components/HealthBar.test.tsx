import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthBar } from './HealthBar';

describe('HealthBar', () => {
  it('mostra "Sem dado" quando score=null', () => {
    render(<HealthBar score={null} />);
    expect(screen.getByText('Sem dado')).toBeInTheDocument();
  });

  it('mostra "Sem dado" quando score=undefined', () => {
    render(<HealthBar score={undefined} />);
    expect(screen.getByText('Sem dado')).toBeInTheDocument();
  });

  it('renderiza barra com score=85 (não mostra "Sem dado")', () => {
    render(<HealthBar score={85} />);
    expect(screen.queryByText('Sem dado')).not.toBeInTheDocument();
  });

  it('clampa scores fora do range', () => {
    const { container } = render(<HealthBar score={150} />);
    const inner = container.querySelector(
      '.adm-healthbar > div > div',
    ) as HTMLElement;
    expect(inner.style.width).toBe('100%');
  });
});
