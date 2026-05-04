import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ColetaEntity } from './coleta.entity';
import { ColetaCommentEntity } from './coleta-comment.entity';
import { CreateColetaCommentDto } from './dto/create-coleta-comment.dto';
import { UserRole } from '../../core/auth/user.entity';

@Injectable()
export class ColetaCommentsService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      )
    ) {
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
    coletaId: string,
  ): Promise<ColetaCommentEntity[]> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaCommentEntity);
      return repo.find({ where: { coletaId }, order: { createdAt: 'ASC' } });
    });
  }

  async addComment(
    tenantId: string,
    coletaId: string,
    dto: CreateColetaCommentDto,
    userId: string,
  ): Promise<ColetaCommentEntity> {
    return this.withSchema(tenantId, async (qr) => {
      const coletaRepo = qr.manager.getRepository(ColetaEntity);
      const coleta = await coletaRepo.findOne({ where: { id: coletaId } });
      if (!coleta) throw new NotFoundException('Coleta não encontrada.');

      const commentRepo = qr.manager.getRepository(ColetaCommentEntity);
      return commentRepo.save(
        commentRepo.create({ coletaId, texto: dto.texto, createdById: userId }),
      );
    });
  }

  async deleteComment(
    tenantId: string,
    coletaId: string,
    commentId: string,
    actor: { userId: string; role: string },
  ): Promise<void> {
    return this.withSchema(tenantId, async (qr) => {
      const repo = qr.manager.getRepository(ColetaCommentEntity);
      const item = await repo.findOne({ where: { id: commentId, coletaId } });
      if (!item) throw new NotFoundException('Comentário não encontrado.');
      if (item.createdById !== actor.userId && actor.role !== UserRole.OWNER) {
        throw new ForbiddenException(
          'Sem permissão para remover este comentário.',
        );
      }
      await repo.remove(item);
    });
  }
}
