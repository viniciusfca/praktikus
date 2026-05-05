import { act, render, screen, within } from '@testing-library/react';
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

  it('seção features não menciona Multi-unidade nem "com sua marca"', () => {
    const { container } = render(<LandingPage />);
    const featuresSection = container.querySelector('section#features');
    expect(featuresSection).not.toBeNull();
    const utils = within(featuresSection as HTMLElement);
    expect(utils.queryByText(/Multi-unidade/i)).not.toBeInTheDocument();
    expect(utils.queryByText(/com sua marca/i)).not.toBeInTheDocument();
  });

  it('seção features inclui Cobrança automática (Asaas)', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Cobrança automática/i)).toBeInTheDocument();
    // "Asaas" também aparece no FAQ e no rodapé do pricing — usar getAllByText.
    expect(screen.getAllByText(/Asaas/i).length).toBeGreaterThanOrEqual(1);
  });

  it('seção features inclui WhatsApp integrado com selo "Em breve"', () => {
    render(<LandingPage />);
    expect(screen.getByText(/WhatsApp integrado/i)).toBeInTheDocument();
    // O selo "Em breve" aparece em segmentos (Médica/Odonto) e agora também no card de WhatsApp.
    const seloMatches = screen.getAllByText(/^Em breve$/i);
    expect(seloMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('subtítulo da seção features diz "sete superpoderes"', () => {
    render(<LandingPage />);
    expect(screen.getByText(/sete superpoderes/i)).toBeInTheDocument();
    expect(screen.queryByText(/seis superpoderes/i)).not.toBeInTheDocument();
  });

  it('pricing: card mostra R$ 89,90 e três listas (universal + oficinas + recicladoras)', () => {
    render(<LandingPage />);
    expect(screen.getByText(/R\$ 89,90/)).toBeInTheDocument();
    expect(screen.getByText(/^Para oficinas$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Para recicladoras$/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadastros e movimentações ilimitados/i)).toBeInTheDocument();
    expect(screen.getByText(/Múltiplas tabelas de preço/i)).toBeInTheDocument();
    expect(screen.getByText(/Coletas agendadas/i)).toBeInTheDocument();
  });

  it('pricing: card NÃO menciona "5 usuários", "Multi-unidade", "com sua marca", nem "prioritário"', () => {
    render(<LandingPage />);
    expect(screen.queryByText(/5 usuários/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Multi-unidade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/com sua marca/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Suporte prioritário/i)).not.toBeInTheDocument();
  });
});
