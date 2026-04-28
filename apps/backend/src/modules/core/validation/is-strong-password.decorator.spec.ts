import { validate } from 'class-validator';
import { IsStrongPassword } from './is-strong-password.decorator';

class TestDto {
  @IsStrongPassword()
  password!: string;
}

async function check(value: unknown) {
  const dto = new TestDto();
  (dto as unknown as Record<string, unknown>).password = value;
  return validate(dto);
}

describe('IsStrongPassword decorator', () => {
  it('accepts a strong password', async () => {
    expect(await check('Strong1!Pass')).toHaveLength(0);
  });

  it('rejects when shorter than 8 characters', async () => {
    expect((await check('Aa1!')).length).toBe(1);
  });

  it('rejects when missing uppercase', async () => {
    expect((await check('strong1!pass')).length).toBe(1);
  });

  it('rejects when missing lowercase', async () => {
    expect((await check('STRONG1!PASS')).length).toBe(1);
  });

  it('rejects when missing number', async () => {
    expect((await check('Strong!!Pass')).length).toBe(1);
  });

  it('rejects when missing special char', async () => {
    expect((await check('Strong11Pass')).length).toBe(1);
  });

  it('reports the standard pt-BR message', async () => {
    const errors = await check('weak');
    expect(errors[0].constraints).toMatchObject({
      isStrongPassword: 'Senha não atende a todos os critérios',
    });
  });
});
