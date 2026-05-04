import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renderiza search, chips e actions slots', () => {
    render(
      <FilterBar
        search={<input placeholder="busca" />}
        chips={<button>chip</button>}
        actions={<button>action</button>}
      />,
    );
    expect(screen.getByPlaceholderText('busca')).toBeInTheDocument();
    expect(screen.getByText('chip')).toBeInTheDocument();
    expect(screen.getByText('action')).toBeInTheDocument();
  });
});
