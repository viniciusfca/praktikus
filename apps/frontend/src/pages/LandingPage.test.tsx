import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('mockup alterna automaticamente para a variante recycling após ~5s', async () => {
    vi.useFakeTimers();
    render(<LandingPage />);
    // Antes do swap: KPIs de workshop, sem KPIs de recycling.
    expect(screen.getByText('OS abertas')).toBeInTheDocument();
    expect(screen.queryByText('Compras hoje')).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

    // Depois do swap: KPIs de recycling, sem KPIs de workshop.
    expect(screen.queryByText('OS abertas')).not.toBeInTheDocument();
    expect(screen.getByText('Compras hoje')).toBeInTheDocument();
    // vi.useRealTimers() moved to afterEach
  });
});
