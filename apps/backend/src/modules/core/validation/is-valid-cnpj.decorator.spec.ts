import { validate } from 'class-validator';
import { IsValidCnpj } from './is-valid-cnpj.decorator';

class TestDto {
  @IsValidCnpj()
  cnpj!: string;
}

async function validateCnpj(value: unknown) {
  const dto = new TestDto();
  (dto as unknown as Record<string, unknown>).cnpj = value;
  return validate(dto);
}

describe('IsValidCnpj decorator', () => {
  it('passes for a valid CNPJ', async () => {
    const errors = await validateCnpj('11222333000181');
    expect(errors).toHaveLength(0);
  });

  it('fails for a wrong-DV CNPJ', async () => {
    const errors = await validateCnpj('12345678000199');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toMatchObject({
      isValidCnpj: 'CNPJ inválido',
    });
  });

  it('fails for non-string input', async () => {
    const errors = await validateCnpj(undefined);
    expect(errors).toHaveLength(1);
  });

  it('respects custom message option', async () => {
    class WithMessage {
      @IsValidCnpj({ message: 'doc required' })
      cnpj!: string;
    }
    const dto = new WithMessage();
    (dto as unknown as Record<string, unknown>).cnpj = '12345678000199';
    const errors = await validate(dto);
    expect(errors[0].constraints).toMatchObject({
      isValidCnpj: 'doc required',
    });
  });
});
