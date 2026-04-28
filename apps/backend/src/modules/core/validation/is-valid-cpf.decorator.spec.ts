import { validate } from 'class-validator';
import { IsValidCpf } from './is-valid-cpf.decorator';

class TestDto {
  @IsValidCpf()
  cpf!: string;
}

async function validateCpf(value: unknown) {
  const dto = new TestDto();
  (dto as unknown as Record<string, unknown>).cpf = value;
  return validate(dto);
}

describe('IsValidCpf decorator', () => {
  it('passes for a valid CPF', async () => {
    const errors = await validateCpf('52998224725');
    expect(errors).toHaveLength(0);
  });

  it('fails for an invalid CPF', async () => {
    const errors = await validateCpf('12345678900');
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toMatchObject({ isValidCpf: 'CPF inválido' });
  });

  it('fails for non-string input', async () => {
    const errors = await validateCpf(null);
    expect(errors).toHaveLength(1);
  });
});
