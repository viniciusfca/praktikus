import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Chip } from './Chip';

describe('admin primitives', () => {
  it('Card renderiza titulo e children', () => {
    render(<Card title="T">conteudo</Card>);
    expect(screen.getByText('T')).toBeInTheDocument();
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('Badge aplica classe da variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.querySelector('.adm-badge--success')).toBeInTheDocument();
  });

  it('Button primary tem classe modificadora', () => {
    const { container } = render(<Button variant="primary">x</Button>);
    expect(container.querySelector('.adm-btn--primary')).toBeInTheDocument();
  });

  it('Avatar renderiza iniciais do nome', () => {
    render(<Avatar name="Vinícius Souza" />);
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('Chip dispara onClick e marca data-active', () => {
    const fn = vi.fn();
    render(
      <Chip active onClick={fn}>
        Sel
      </Chip>,
    );
    fireEvent.click(screen.getByText('Sel'));
    expect(fn).toHaveBeenCalled();
    expect(screen.getByText('Sel')).toHaveAttribute('data-active', 'true');
  });
});
