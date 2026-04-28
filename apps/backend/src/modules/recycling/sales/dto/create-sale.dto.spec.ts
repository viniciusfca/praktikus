import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaymentMethod } from '@praktikus/shared';
import { CreateSaleDto } from './create-sale.dto';

describe('CreateSaleDto', () => {
  const validBase = {
    buyerId: '00000000-0000-0000-0000-000000000001',
    items: [{ productId: '00000000-0000-0000-0000-000000000002', quantity: 1, unitPrice: 1 }],
  };

  it('rejects payload without paymentMethod', async () => {
    const dto = plainToInstance(CreateSaleDto, { ...validBase });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('rejects paymentMethod not in enum', async () => {
    const dto = plainToInstance(CreateSaleDto, { ...validBase, paymentMethod: 'BITCOIN' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
  });

  it('accepts each PaymentMethod value', async () => {
    for (const m of Object.values(PaymentMethod)) {
      const dto = plainToInstance(CreateSaleDto, { ...validBase, paymentMethod: m });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentMethod')).toBe(false);
    }
  });
});
