import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnitsService } from './units.service';
import { UnitEntity } from './unit.entity';

const mockUnitRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: { getRepository: jest.fn().mockReturnValue(mockUnitRepo) },
  release: jest.fn().mockResolvedValue(undefined),
};
const mockDataSource = { createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner) };

describe('UnitsService', () => {
  let service: UnitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitsService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();
    service = module.get<UnitsService>(UnitsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockReturnValue(mockUnitRepo);
  });

  it('should list all units', async () => {
    mockUnitRepo.find.mockResolvedValue([{ id: 'u1', name: 'Quilograma', abbreviation: 'kg' }]);
    const result = await service.list('00000000-0000-0000-0000-000000000001');
    expect(result).toHaveLength(1);
    expect(mockQueryRunner.query).toHaveBeenCalledWith(expect.stringContaining('SET search_path'));
  });

  it('should create a unit', async () => {
    const dto = { name: 'Quilograma', abbreviation: 'kg' };
    const created = { id: 'u1', ...dto };
    mockUnitRepo.create.mockReturnValue(created);
    mockUnitRepo.save.mockResolvedValue(created);
    const result = await service.create('00000000-0000-0000-0000-000000000001', dto);
    expect(result).toEqual(created);
    expect(mockUnitRepo.save).toHaveBeenCalled();
  });

  it('should update a unit', async () => {
    const unit = { id: 'u1', name: 'Quilograma', abbreviation: 'kg' };
    mockUnitRepo.findOne.mockResolvedValue(unit);
    mockUnitRepo.save.mockResolvedValue({ ...unit, abbreviation: 'KG' });
    const result = await service.update('00000000-0000-0000-0000-000000000001', 'u1', { abbreviation: 'KG' });
    expect(result.abbreviation).toBe('KG');
  });

  it('should throw NotFoundException on update when not found', async () => {
    mockUnitRepo.findOne.mockResolvedValue(null);
    await expect(service.update('00000000-0000-0000-0000-000000000001', 'missing', {})).rejects.toThrow(NotFoundException);
  });

  it('should delete a unit', async () => {
    const unit = { id: 'u1' };
    mockUnitRepo.findOne.mockResolvedValue(unit);
    mockUnitRepo.remove = jest.fn().mockResolvedValue(undefined);
    // mock no products referencing this unit
    mockQueryRunner.query
      .mockResolvedValueOnce(undefined) // SET search_path
      .mockResolvedValueOnce([{ count: '0' }]); // product count
    await service.delete('00000000-0000-0000-0000-000000000001', 'u1');
    expect(mockUnitRepo.remove).toHaveBeenCalledWith(unit);
  });

  it('should throw ConflictException on delete when unit has products', async () => {
    const unit = { id: 'u1' };
    mockUnitRepo.findOne.mockResolvedValue(unit);
    mockQueryRunner.query
      .mockResolvedValueOnce(undefined) // SET search_path
      .mockResolvedValueOnce([{ count: '3' }]); // product count > 0
    await expect(service.delete('00000000-0000-0000-0000-000000000001', 'u1')).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException on delete when not found', async () => {
    mockUnitRepo.findOne.mockResolvedValue(null);
    await expect(service.delete('00000000-0000-0000-0000-000000000001', 'missing')).rejects.toThrow(NotFoundException);
  });
});
