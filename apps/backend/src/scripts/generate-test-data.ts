import 'reflect-metadata';
import { faker } from '@faker-js/faker/locale/pt_BR';

/**
 * Brazilian fiscal data validators + generators, plus persona helpers
 * for E2E test runs. NOT for production use — generates random valid
 * fiscal numbers without ownership claims.
 */

function randomDigits(n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function allSameDigit(s: string): boolean {
  return /^(\d)\1+$/.test(s);
}

// ---------- CNPJ ----------

function cnpjCheckDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (allSameDigit(cnpj)) return false;
  const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d13 = cnpjCheckDigit(cnpj.slice(0, 12), W1);
  if (d13 !== parseInt(cnpj[12], 10)) return false;
  const d14 = cnpjCheckDigit(cnpj.slice(0, 13), W2);
  return d14 === parseInt(cnpj[13], 10);
}

export function generateCnpj(): string {
  while (true) {
    const base = randomDigits(8) + '0001';
    const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d13 = cnpjCheckDigit(base, W1);
    const d14 = cnpjCheckDigit(base + d13, W2);
    const cnpj = `${base}${d13}${d14}`;
    if (!allSameDigit(cnpj)) return cnpj;
  }
}

// ---------- CPF ----------

function cpfCheckDigit(digits: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * (factor - i);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (allSameDigit(cpf)) return false;
  const d10 = cpfCheckDigit(cpf.slice(0, 9), 10);
  if (d10 !== parseInt(cpf[9], 10)) return false;
  const d11 = cpfCheckDigit(cpf.slice(0, 10), 11);
  return d11 === parseInt(cpf[10], 10);
}

export function generateCpf(): string {
  while (true) {
    const base = randomDigits(9);
    const d10 = cpfCheckDigit(base, 10);
    const d11 = cpfCheckDigit(`${base}${d10}`, 11);
    const cpf = `${base}${d10}${d11}`;
    if (!allSameDigit(cpf)) return cpf;
  }
}

// ---------- Email / Phone ----------

export function generateMailinatorEmail(phaseLabel: string, seq: number): string {
  return `praktikus-qa-${phaseLabel.toLowerCase()}-${seq}@mailinator.com`;
}

export function generatePhoneBr(): string {
  const ddd = String(11 + Math.floor(Math.random() * 90));
  return `${ddd.padStart(2, '0').slice(-2)}9${randomDigits(8)}`;
}

// ---------- Persona consolidada ----------

export interface Persona {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  telefone: string;
  cep: string;
  ownerName: string;
  ownerEmail: string;
  ownerCpf: string;
  ownerPassword: string;
}

export function generatePersona({
  phaseLabel,
  seq,
}: {
  phaseLabel: string;
  seq: number;
}): Persona {
  return {
    razaoSocial: `${faker.company.name()} Reciclagem LTDA`,
    nomeFantasia: `${faker.company.buzzNoun()} Recicla`,
    cnpj: generateCnpj(),
    telefone: generatePhoneBr(),
    cep: '01310100',
    ownerName: faker.person.fullName(),
    ownerEmail: generateMailinatorEmail(phaseLabel, seq),
    ownerCpf: generateCpf(),
    ownerPassword: 'Praktikus@2026',
  };
}

// ---------- CLI: pre-generate batch for Claude ----------

if (require.main === module) {
  const count = parseInt(process.argv[2] ?? '1', 10);
  const out: Persona[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generatePersona({ phaseLabel: 'cli', seq: i }));
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}
