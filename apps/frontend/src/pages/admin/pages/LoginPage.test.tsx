import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

vi.mock('../../../store/platform-auth.store', () => ({
  usePlatformAuthStore: vi.fn().mockImplementation((s: any) =>
    s({ setTokens: vi.fn() }),
  ),
}));

describe('LoginPage', () => {
  it('renderiza form de login', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Praktikus Admin')).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('botão "Esqueci a senha" está disabled em Fase 1', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    const btn = screen.getByText(/Esqueci a senha/i);
    expect(btn).toBeDisabled();
  });
});
