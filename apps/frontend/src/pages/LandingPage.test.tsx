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
    expect(screen.queryByText(/Relatórios v2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Novo$/i)).not.toBeInTheDocument();
  });

  it('subtítulo do hero menciona oficinas e recicladoras (sem clínicas)', () => {
    render(<LandingPage />);
    const subtitle = screen.getByText(/Plataforma feita para/i);
    expect(subtitle.textContent).toMatch(/oficinas e recicladoras/i);
    expect(subtitle.textContent).not.toMatch(/clínica/i);
  });

  it('mockup do hero (workshop) mostra itens da oficina', () => {
    render(<LandingPage />);
    // "OS abertas" and "Ticket médio" are unique to workshop KPIs;
    // "Agendamentos" appears in both menu and KPI label, so we use getAllByText.
    expect(screen.getByText('OS abertas')).toBeInTheDocument();
    expect(screen.getByText('Ticket médio')).toBeInTheDocument();
    expect(screen.getAllByText('Agendamentos').length).toBeGreaterThan(0);
    expect(screen.getByText('Veículos')).toBeInTheDocument();
  });
});
