import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';

vi.mock('../../services/auth.service', () => ({
  authService: { login: vi.fn() },
}));

vi.mock('../../store/auth.store', () => ({
  useAuthStore: vi.fn((selector: any) => selector({ setTokens: vi.fn() })),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...(actual as object), useNavigate: () => mockNavigate };
});

import { authService } from '../../services/auth.service';
const mockAuthService = authService as any;

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderLogin = () =>
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'notanemail' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
    });
  });

  it('calls authService.login with form values on submit', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'owner@test.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'owner@test.com',
        password: 'senha1234',
      });
    });
  });

  it('navigates to dashboard after successful login', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workshop/dashboard');
    });
  });

  it('shows error message on failed login', async () => {
    mockAuthService.login.mockRejectedValue({
      response: { data: { message: 'Credenciais inválidas.' } },
    });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
    });
  });
});
