import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterService } from './cash-register.service';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

describe('CashRegisterController', () => {
  let controller: CashRegisterController;
  const mockService = {
    open: jest.fn(),
    close: jest.fn(),
    getCurrent: jest.fn(),
    addTransaction: jest.fn(),
    getTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashRegisterController],
      providers: [{ provide: CashRegisterService, useValue: mockService }],
    }).compile();
    controller = module.get<CashRegisterController>(CashRegisterController);
    jest.clearAllMocks();
  });

  describe('POST /open', () => {
    it('passes openingBalance from dto to service', async () => {
      const req = {
        user: { tenantId: 'tenant-1', userId: 'user-1' },
      } as any;
      mockService.open.mockResolvedValue({ id: 's1', openingBalance: 75.5 });

      await controller.open(req, { openingBalance: 75.5 } as OpenCashSessionDto);

      expect(mockService.open).toHaveBeenCalledWith('tenant-1', 'user-1', 75.5);
    });
  });

  describe('OpenCashSessionDto validation', () => {
    it('accepts 0 as openingBalance', async () => {
      const dto = plainToInstance(OpenCashSessionDto, { openingBalance: 0 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts valid positive amount up to limit', async () => {
      const dto = plainToInstance(OpenCashSessionDto, {
        openingBalance: 999999.99,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects negative openingBalance', async () => {
      const dto = plainToInstance(OpenCashSessionDto, { openingBalance: -1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('rejects amount above 999999.99', async () => {
      const dto = plainToInstance(OpenCashSessionDto, {
        openingBalance: 1000000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('rejects more than 2 decimal places', async () => {
      const dto = plainToInstance(OpenCashSessionDto, {
        openingBalance: 1.234,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNumber');
    });

    it('rejects non-numeric value', async () => {
      const dto = plainToInstance(OpenCashSessionDto, {
        openingBalance: 'abc' as unknown as number,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
