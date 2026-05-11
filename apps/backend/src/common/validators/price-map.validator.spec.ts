import { validate } from 'class-validator';
import { IsPriceMap } from './price-map.validator';

const UUID1 = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';

class TestDto {
  @IsPriceMap()
  prices: unknown;
}

async function runValidation(value: unknown): Promise<boolean> {
  const dto = new TestDto();
  dto.prices = value;
  const errors = await validate(dto);
  return errors.length === 0;
}

describe('IsPriceMap', () => {
  it('aceita mapa vazio', async () => {
    expect(await runValidation({})).toBe(true);
  });

  it('aceita mapa com UUID e preço positivo', async () => {
    expect(await runValidation({ [UUID1]: 5.5, [UUID2]: 10 })).toBe(true);
  });

  it('aceita null como valor (preço ausente para uma tabela)', async () => {
    expect(await runValidation({ [UUID1]: null })).toBe(true);
  });

  it('rejeita chave não-UUID', async () => {
    expect(await runValidation({ 'not-a-uuid': 5 })).toBe(false);
  });

  it('rejeita valor negativo', async () => {
    expect(await runValidation({ [UUID1]: -1 })).toBe(false);
  });

  it('rejeita valor zero', async () => {
    expect(await runValidation({ [UUID1]: 0 })).toBe(false);
  });

  it('rejeita valor Infinity', async () => {
    expect(await runValidation({ [UUID1]: Infinity })).toBe(false);
  });

  it('rejeita valor string', async () => {
    expect(await runValidation({ [UUID1]: '5' })).toBe(false);
  });

  it('rejeita null como mapa inteiro', async () => {
    expect(await runValidation(null)).toBe(false);
  });

  it('rejeita array', async () => {
    expect(await runValidation([1, 2, 3])).toBe(false);
  });

  it('rejeita string como mapa', async () => {
    expect(await runValidation('not-a-map')).toBe(false);
  });
});
