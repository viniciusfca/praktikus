import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ColetaCommentsService } from './coleta-comments.service';

const coletaRepo = { findOne: jest.fn() };
const commentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'cm1', ...x })),
  remove: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity.name === 'ColetaEntity') return coletaRepo;
      if (entity.name === 'ColetaCommentEntity') return commentRepo;
      return {};
    }),
  },
};
const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('ColetaCommentsService', () => {
  let service: ColetaCommentsService;
  const TENANT = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ColetaCommentsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<ColetaCommentsService>(ColetaCommentsService);
    jest.clearAllMocks();
  });

  describe('addComment', () => {
    it('creates comment when coleta exists', async () => {
      coletaRepo.findOne.mockResolvedValue({ id: 'c1' });
      const result = await service.addComment(
        TENANT,
        'c1',
        { texto: 'hi' },
        'user1',
      );
      expect(result.id).toBe('cm1');
      expect(commentRepo.save).toHaveBeenCalled();
    });

    it('throws 404 when coleta missing', async () => {
      coletaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addComment(TENANT, 'x', { texto: 'hi' }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('allows author to delete', async () => {
      commentRepo.findOne.mockResolvedValue({
        id: 'cm1',
        coletaId: 'c1',
        createdById: 'user1',
      });
      await service.deleteComment(TENANT, 'c1', 'cm1', {
        userId: 'user1',
        role: 'EMPLOYEE',
      });
      expect(commentRepo.remove).toHaveBeenCalled();
    });

    it('allows OWNER to delete others comments', async () => {
      commentRepo.findOne.mockResolvedValue({
        id: 'cm1',
        coletaId: 'c1',
        createdById: 'other',
      });
      await service.deleteComment(TENANT, 'c1', 'cm1', {
        userId: 'owner1',
        role: 'OWNER',
      });
      expect(commentRepo.remove).toHaveBeenCalled();
    });

    it('forbids non-author employees from deleting', async () => {
      commentRepo.findOne.mockResolvedValue({
        id: 'cm1',
        coletaId: 'c1',
        createdById: 'other',
      });
      await expect(
        service.deleteComment(TENANT, 'c1', 'cm1', {
          userId: 'user1',
          role: 'EMPLOYEE',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
