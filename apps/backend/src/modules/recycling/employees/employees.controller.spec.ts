import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { UserRole } from '../../core/auth/user.entity';

describe('EmployeesController', () => {
  let controller: EmployeesController;
  const mockService = {
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    getPermissions: jest.fn(),
    updatePermissions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [{ provide: EmployeesService, useValue: mockService }],
    }).compile();
    controller = module.get<EmployeesController>(EmployeesController);
    jest.clearAllMocks();
  });

  describe('GET me/permissions', () => {
    it('returns all-true permissions for OWNER without hitting the DB', async () => {
      const req = {
        user: {
          tenantId: 'tenant-1',
          userId: 'user-owner',
          role: UserRole.OWNER,
        },
      } as any;

      const result = await controller.getMyPermissions(req);

      expect(result).toEqual({
        canManageSuppliers: true,
        canManageBuyers: true,
        canManageProducts: true,
        canOpenCloseCash: true,
        canViewStock: true,
        canViewReports: true,
        canRegisterPurchases: true,
        canRegisterSales: true,
        canManageColetas: true,
      });
      expect(mockService.getPermissions).not.toHaveBeenCalled();
    });

    it('returns DB permissions for EMPLOYEE', async () => {
      const stored = {
        userId: 'user-emp',
        canManageSuppliers: false,
        canManageBuyers: true,
        canManageProducts: true,
        canOpenCloseCash: false,
        canViewStock: true,
        canViewReports: false,
        canRegisterPurchases: true,
        canRegisterSales: false,
        canManageColetas: true,
      };
      mockService.getPermissions.mockResolvedValue(stored);

      const req = {
        user: {
          tenantId: 'tenant-1',
          userId: 'user-emp',
          role: UserRole.EMPLOYEE,
        },
      } as any;

      const result = await controller.getMyPermissions(req);

      expect(mockService.getPermissions).toHaveBeenCalledWith(
        'tenant-1',
        'user-emp',
      );
      expect(result).toEqual(stored);
    });
  });
});
