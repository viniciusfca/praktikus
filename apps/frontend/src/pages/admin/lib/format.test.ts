import { describe, it, expect } from 'vitest';
import {
  formatBRL,
  formatPercent,
  formatNumber,
  initialsOf,
} from './format';

describe('format helpers', () => {
  it('formatBRL retorna — para null/undefined', () => {
    expect(formatBRL(null)).toBe('—');
    expect(formatBRL(undefined)).toBe('—');
  });

  it('formatBRL formata valores', () => {
    expect(formatBRL(1234.56)).toMatch(/R\$\s?1\.234,56/);
  });

  it('formatPercent retorna — para null e NaN', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(NaN)).toBe('—');
  });

  it('formatPercent formata 0.4 como 40.0%', () => {
    expect(formatPercent(0.4)).toBe('40.0%');
  });

  it('formatNumber retorna — para null', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(1234)).toBe('1.234');
  });

  it('initialsOf', () => {
    expect(initialsOf('Vinícius Souza')).toBe('VS');
    expect(initialsOf('Vinícius')).toBe('VI');
    expect(initialsOf('')).toBe('?');
  });
});
