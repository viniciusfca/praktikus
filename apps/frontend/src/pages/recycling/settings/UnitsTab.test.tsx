import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnitsTab } from './UnitsTab';

vi.mock('../../../services/recycling/units.service', () => ({
  unitsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { unitsService } from '../../../services/recycling/units.service';

describe('UnitsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders list of units from the service', async () => {
    vi.mocked(unitsService.list).mockResolvedValue([
      { id: '1', name: 'Quilograma', abbreviation: 'kg' },
      { id: '2', name: 'Tonelada', abbreviation: 't' },
    ]);

    render(<UnitsTab />);

    await waitFor(() => {
      expect(screen.getByText('Quilograma')).toBeInTheDocument();
    });
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('Tonelada')).toBeInTheDocument();
    expect(screen.getByText('t')).toBeInTheDocument();
  });

  it('shows empty state when no units exist', async () => {
    vi.mocked(unitsService.list).mockResolvedValue([]);

    render(<UnitsTab />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma unidade encontrada')).toBeInTheDocument();
    });
    expect(screen.getByText(/Cadastre a primeira unidade/)).toBeInTheDocument();
  });
});
