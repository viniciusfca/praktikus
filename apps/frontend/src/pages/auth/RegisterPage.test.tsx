import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterPage } from './RegisterPage';

const mockNavigate = vi.fn();

vi.mock('../../services/auth.service', () => ({
  authService: { register: vi.fn() },
}));

vi.mock('../../store/auth.store', () => ({
  useAuthStore: vi.fn((selector: any) => selector({ setTokens: vi.fn() })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...(actual as object), useNavigate: () => mockNavigate };
});

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderPage = () =>
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

  it('renders step 1 with company fields', () => {
    renderPage();
    expect(screen.getByLabelText(/cnpj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/raz[aã]o social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome fantasia/i)).toBeInTheDocument();
  });

  it('shows CNPJ validation error for non-14-digit input', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/cnpj/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/raz[aã]o social/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/nome fantasia/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await waitFor(() => {
      expect(screen.getByText(/14 d[ií]gitos/i)).toBeInTheDocument();
    });
  });

  it('advances to step 2 with valid step 1 data', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/cnpj/i), { target: { value: '12345678000199' } });
    fireEvent.change(screen.getByLabelText(/raz[aã]o social/i), { target: { value: 'Auto Center Ltda' } });
    fireEvent.change(screen.getByLabelText(/nome fantasia/i), { target: { value: 'Auto Center' } });
    fireEvent.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    });
  });

  it('shows stepper with 2 steps', () => {
    renderPage();
    expect(screen.getByText(/dados da oficina/i)).toBeInTheDocument();
    expect(screen.getByText(/dados do respons/i)).toBeInTheDocument();
  });

  it('calls register and navigates to dashboard on successful submission', async () => {
    const { authService: mockAuthService } = await import('../../services/auth.service');
    (mockAuthService.register as ReturnType<typeof vi.fn>).mockResolvedValue({
      access_token: 'tok',
      refresh_token: 'ref',
    });

    renderPage();

    // Step 1
    fireEvent.change(screen.getByLabelText(/cnpj/i), { target: { value: '12345678000199' } });
    fireEvent.change(screen.getByLabelText(/raz[aã]o social/i), { target: { value: 'Auto Center Ltda' } });
    fireEvent.change(screen.getByLabelText(/nome fantasia/i), { target: { value: 'Auto Center' } });
    fireEvent.click(screen.getByRole('button', { name: /pr[oó]ximo/i }));

    // Step 2
    await waitFor(() => expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/seu nome/i), { target: { value: 'João Silva' } });
    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar/i }));

    await waitFor(() => {
      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.not.objectContaining({ confirmPassword: expect.anything() }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/workshop/dashboard');
    });
  });
});
