import {
  generateCnpj,
  generateCpf,
  isValidCnpj,
  isValidCpf,
  generateMailinatorEmail,
  generatePhoneBr,
  generatePersona,
} from './generate-test-data';

describe('generateCnpj', () => {
  it('returns 14-digit string', () => {
    const cnpj = generateCnpj();
    expect(cnpj).toMatch(/^\d{14}$/);
  });

  it('returns a CNPJ that passes the checksum algorithm', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidCnpj(generateCnpj())).toBe(true);
    }
  });

  it('rejects known invalid CNPJs', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('12345678901234')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });

  it('accepts known valid CNPJs', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });
});

describe('generateCpf', () => {
  it('returns 11-digit string', () => {
    const cpf = generateCpf();
    expect(cpf).toMatch(/^\d{11}$/);
  });

  it('returns a CPF that passes the checksum algorithm', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidCpf(generateCpf())).toBe(true);
    }
  });

  it('rejects known invalid CPFs', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCpf('')).toBe(false);
  });
});

describe('generateMailinatorEmail', () => {
  it('returns email with @mailinator.com', () => {
    expect(generateMailinatorEmail('qa', 1)).toBe('praktikus-qa-qa-1@mailinator.com');
  });

  it('lowercases the label', () => {
    expect(generateMailinatorEmail('Phase1', 0)).toBe('praktikus-qa-phase1-0@mailinator.com');
  });
});

describe('generatePhoneBr', () => {
  it('returns 11-digit string starting with 9 in the 3rd position', () => {
    const phone = generatePhoneBr();
    expect(phone).toMatch(/^\d{2}9\d{8}$/);
  });
});

describe('generatePersona', () => {
  it('returns a complete persona for signup', () => {
    const persona = generatePersona({ phaseLabel: 'p1', seq: 0 });
    expect(persona).toEqual({
      razaoSocial: expect.any(String),
      nomeFantasia: expect.any(String),
      cnpj: expect.stringMatching(/^\d{14}$/),
      telefone: expect.stringMatching(/^\d{11}$/),
      cep: '01310100',
      ownerName: expect.any(String),
      ownerEmail: 'praktikus-qa-p1-0@mailinator.com',
      ownerCpf: expect.stringMatching(/^\d{11}$/),
      ownerPassword: 'Praktikus@2026',
    });
    expect(isValidCnpj(persona.cnpj)).toBe(true);
    expect(isValidCpf(persona.ownerCpf)).toBe(true);
  });
});
