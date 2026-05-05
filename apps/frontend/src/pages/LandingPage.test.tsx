import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('renderiza sem crashar', () => {
    const { container } = render(<LandingPage />);
    expect(container.firstChild).not.toBeNull();
  });

  it('não exibe o selo "Novo · Relatórios v2"', () => {
    render(<LandingPage />);
    expect(screen.queryByText(/Relatórios v2/i)).toBeNull();
    expect(screen.queryByText(/^Novo$/i)).toBeNull();
  });
});
