import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

describe('<PasswordStrengthMeter />', () => {
  it('renders nothing when password is empty', () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders bar and checklist when typing starts', () => {
    render(<PasswordStrengthMeter password="a" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/Pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/Letra maiúscula/i)).toBeInTheDocument();
    expect(screen.getByText(/Letra minúscula/i)).toBeInTheDocument();
    expect(screen.getByText(/Número/i)).toBeInTheDocument();
    expect(screen.getByText(/Caractere especial/i)).toBeInTheDocument();
  });

  it('shows strength label "Fraca" for 1-2 criteria met', () => {
    render(<PasswordStrengthMeter password="a" />);
    expect(screen.getByText('Fraca')).toBeInTheDocument();
  });

  it('shows strength label "Média" for 3-4 criteria met', () => {
    render(<PasswordStrengthMeter password="aB1" />);
    expect(screen.getByText('Média')).toBeInTheDocument();
  });

  it('shows strength label "Forte" when all five criteria are met', () => {
    render(<PasswordStrengthMeter password="Strong1!Pass" />);
    expect(screen.getByText('Forte')).toBeInTheDocument();
  });

  it('hides the checklist when all criteria are met', () => {
    render(<PasswordStrengthMeter password="Strong1!Pass" />);
    expect(screen.queryByText(/Pelo menos 8 caracteres/i)).not.toBeInTheDocument();
  });

  it('keeps the bar visible when all criteria are met', () => {
    render(<PasswordStrengthMeter password="Strong1!Pass" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
