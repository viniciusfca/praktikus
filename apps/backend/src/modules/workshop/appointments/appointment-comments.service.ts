import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AppointmentEntity } from './appointment.entity';
import { AppointmentCommentEntity } from './appointment-comment.entity';
import { CreateAppointmentCommentDto } from './dto/create-appointment-comment.dto';

@Injectable()
export class AppointmentCommentsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr);
    } finally {
      await qr.release();
    }
  }

  async listComments(
    tenantId: string,
    appointmentId: string,
  ): Promise<AppointmentCommentEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(AppointmentCommentEntity);
      return repo.find({ where: { appointmentId }, order: { createdAt: 'ASC' } });
    });
  }

  async addComment(
    tenantId: string,
    appointmentId: string,
    dto: CreateAppointmentCommentDto,
    userId: string,
  ): Promise<AppointmentCommentEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const apptRepo = qr.manager.getRepository(AppointmentEntity);
      const appt = await apptRepo.findOne({ where: { id: appointmentId } });
      if (!appt) throw new NotFoundException('Agendamento não encontrado.');

      const commentRepo = qr.manager.getRepository(AppointmentCommentEntity);
      return commentRepo.save(
        commentRepo.create({ appointmentId, texto: dto.texto, createdById: userId }),
      );
    });
  }

  async deleteComment(
    tenantId: string,
    appointmentId: string,
    commentId: string,
  ): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(AppointmentCommentEntity);
      const item = await repo.findOne({ where: { id: commentId, appointmentId } });
      if (!item) throw new NotFoundException('Comentário não encontrado.');
      await repo.remove(item);
    });
  }
}
