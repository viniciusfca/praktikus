import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentCommentsService } from './appointment-comments.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const mockCommentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockApptRepo = {
  findOne: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  manager: {
    getRepository: jest.fn((entity) => {
      if (entity.name === 'AppointmentEntity') return mockApptRepo;
      return mockCommentRepo;
    }),
  },
  release: jest.fn().mockResolvedValue(undefined),
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('AppointmentCommentsService', () => {
  let service: AppointmentCommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentCommentsService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<AppointmentCommentsService>(AppointmentCommentsService);
    jest.clearAllMocks();
    mockQueryRunner.manager.getRepository.mockImplementation((entity: any) => {
      if (entity?.name === 'AppointmentEntity') return mockApptRepo;
      return mockCommentRepo;
    });
  });

  describe('listComments', () => {
    it('should return comments for an appointment', async () => {
      const comments = [{ id: 'c1', texto: 'Ligou, não atendeu' }];
      mockCommentRepo.find.mockResolvedValue(comments);

      const result = await service.listComments(TENANT_ID, 'a1');

      expect(result).toEqual(comments);
    });
  });

  describe('addComment', () => {
    it('should throw NotFoundException when appointment not found', async () => {
      mockApptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addComment(TENANT_ID, 'nonexistent', { texto: 'teste' }, 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and return comment when appointment exists', async () => {
      mockApptRepo.findOne.mockResolvedValue({ id: 'a1' });
      const comment = { id: 'c1', texto: 'Ligou, não atendeu', appointmentId: 'a1' };
      mockCommentRepo.create.mockReturnValue(comment);
      mockCommentRepo.save.mockResolvedValue(comment);

      const result = await service.addComment(TENANT_ID, 'a1', { texto: 'Ligou, não atendeu' }, 'user1');

      expect(result).toEqual(comment);
    });
  });

  describe('deleteComment', () => {
    it('should throw NotFoundException when comment not found', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteComment(TENANT_ID, 'a1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete comment when found', async () => {
      const comment = { id: 'c1', appointmentId: 'a1' };
      mockCommentRepo.findOne.mockResolvedValue(comment);
      mockCommentRepo.remove.mockResolvedValue(undefined);

      await service.deleteComment(TENANT_ID, 'a1', 'c1');

      expect(mockCommentRepo.remove).toHaveBeenCalledWith(comment);
    });
  });
});
