import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeesService } from './employees.service';
import { UserEntity } from '../../core/auth/user.entity';
import { EmployeePermissionsEntity } from './employee-permissions.entity';

const mockUserRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), find: jest.fn(), remove: jest.fn() };
const mockPermRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity === UserEntity) return mockUserRepo;
      return mockPermRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('EmployeesService', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<EmployeesService>(EmployeesService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity) => {
      if (entity === UserEntity) return mockUserRepo;
      return mockPermRepo;
    });
  });

  describe('list', () => {
    it('should return employees for the tenant', async () => {
      const employees = [{ id: 'u1', name: 'Ana', role: 'EMPLOYEE' }];
      mockUserRepo.find.mockResolvedValue(employees);
      const result = await service.list('00000000-0000-0000-0000-000000000001');
      expect(result).toEqual(employees);
    });
  });

  describe('create', () => {
    it('should throw ConflictException when email already exists in tenant', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create('00000000-0000-0000-0000-000000000001', {
          name: 'Ana', email: 'ana@test.com', password: 'senha123',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should create employee with default permissions', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const newUser = { id: 'u1', name: 'Ana', role: 'EMPLOYEE' };
      mockUserRepo.create.mockReturnValue(newUser);
      mockUserRepo.save.mockResolvedValue(newUser);
      mockPermRepo.create.mockReturnValue({ userId: 'u1' });
      mockPermRepo.save.mockResolvedValue({ userId: 'u1' });

      const result = await service.create('00000000-0000-0000-0000-000000000001', {
        name: 'Ana', email: 'ana@test.com', password: 'senha123',
      });

      expect(mockPermRepo.save).toHaveBeenCalled();
      expect(result).toEqual(newUser);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when employee not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(
        service.delete('00000000-0000-0000-0000-000000000001', 'missing')
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove employee when found', async () => {
      const user = { id: 'u1', role: 'EMPLOYEE' };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.remove = jest.fn().mockResolvedValue(undefined);
      await service.delete('00000000-0000-0000-0000-000000000001', 'u1');
      expect(mockUserRepo.remove).toHaveBeenCalledWith(user);
    });
  });

  describe('getPermissions', () => {
    it('should throw NotFoundException when permissions not found', async () => {
      mockPermRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getPermissions('00000000-0000-0000-0000-000000000001', 'u1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return permissions for employee', async () => {
      const perms = { userId: 'u1', canManageSuppliers: true };
      mockPermRepo.findOne.mockResolvedValue(perms);
      const result = await service.getPermissions('00000000-0000-0000-0000-000000000001', 'u1');
      expect(result).toEqual(perms);
    });
  });

  describe('updatePermissions', () => {
    it('should throw NotFoundException when permissions not found', async () => {
      mockPermRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updatePermissions('00000000-0000-0000-0000-000000000001', 'u1', { canManageBuyers: true })
      ).rejects.toThrow(NotFoundException);
    });

    it('should update and return permissions', async () => {
      const perms = { userId: 'u1', canManageSuppliers: true, canManageBuyers: false };
      mockPermRepo.findOne.mockResolvedValue(perms);
      mockPermRepo.save.mockResolvedValue({ ...perms, canManageBuyers: true });

      const result = await service.updatePermissions('00000000-0000-0000-0000-000000000001', 'u1', { canManageBuyers: true });
      expect(result.canManageBuyers).toBe(true);
    });
  });
});
