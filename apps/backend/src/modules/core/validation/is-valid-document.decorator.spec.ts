import { validate } from 'class-validator';
import { IsValidDocument } from './is-valid-document.decorator';

class TestDto {
  @IsValidDocument()
  document!: string;
}

async function check(value: unknown) {
  const dto = new TestDto();
  (dto as unknown as Record<string, unknown>).document = value;
  return validate(dto);
}

describe('IsValidDocument decorator', () => {
  it('accepts valid CPF', async () => {
    expect(await check('52998224725')).toHaveLength(0);
  });

  it('accepts valid CNPJ', async () => {
    expect(await check('11222333000181')).toHaveLength(0);
  });

  it('rejects invalid CPF and CNPJ with the same message', async () => {
    const cpfErrors = await check('12345678900');
    const cnpjErrors = await check('12345678000199');
    expect(cpfErrors[0].constraints).toMatchObject({
      isValidDocument: 'CPF ou CNPJ inválido',
    });
    expect(cnpjErrors[0].constraints).toMatchObject({
      isValidDocument: 'CPF ou CNPJ inválido',
    });
  });

  it('rejects 10/12/13 digit input', async () => {
    expect((await check('1234567890')).length).toBe(1);
    expect((await check('123456789012')).length).toBe(1);
    expect((await check('1234567890123')).length).toBe(1);
  });
});
