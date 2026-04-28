import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

vi.mock('../../services/cep.service', () => ({
  lookupCep: vi.fn(),
}));

import { AddressFields } from './AddressFields';
import { lookupCep } from '../../services/cep.service';

const mockLookup = lookupCep as unknown as ReturnType<typeof vi.fn>;

interface Form {
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
  zip: string;
}

function Harness() {
  const { control, setValue, formState: { errors } } = useForm<Form>({
    defaultValues: {
      street: '', number: '', neighborhood: '', complement: '', city: '', state: '', zip: '',
    },
  });
  return <AddressFields control={control} setValue={setValue} errors={errors} />;
}

describe('<AddressFields />', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all 7 address inputs', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/CEP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rua/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Número/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bairro/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Complemento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Estado/i)).toBeInTheDocument();
  });

  it('fills street/neighborhood/city/state when 8 digits are typed in CEP', async () => {
    mockLookup.mockResolvedValue({
      cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP',
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/CEP/i), '01001000');
    await waitFor(() => expect(mockLookup).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByLabelText(/Rua/i)).toHaveValue('Praça da Sé');
      expect(screen.getByLabelText(/Bairro/i)).toHaveValue('Sé');
      expect(screen.getByLabelText(/Cidade/i)).toHaveValue('São Paulo');
      expect(screen.getByLabelText(/Estado/i)).toHaveValue('SP');
    });
  });

  it('shows an error message below CEP when lookup fails with 404', async () => {
    mockLookup.mockRejectedValue({ response: { status: 404 } });
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/CEP/i), '00000000');
    await waitFor(() => expect(screen.getByText(/CEP não encontrado/i)).toBeInTheDocument());
  });

  it('keeps fields editable after auto-fill', async () => {
    mockLookup.mockResolvedValue({
      cep: '01001000', street: 'Praça da Sé', neighborhood: 'Sé', city: 'São Paulo', state: 'SP',
    });
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/CEP/i), '01001000');
    await waitFor(() => expect(screen.getByLabelText(/Rua/i)).toHaveValue('Praça da Sé'));
    await user.clear(screen.getByLabelText(/Rua/i));
    await user.type(screen.getByLabelText(/Rua/i), 'Outra Rua');
    expect(screen.getByLabelText(/Rua/i)).toHaveValue('Outra Rua');
  });
});
