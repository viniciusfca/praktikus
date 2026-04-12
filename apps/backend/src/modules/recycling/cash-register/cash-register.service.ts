import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CashSessionStatus } from '@praktikus/shared';
import { CashSessionEntity } from './cash-session.entity';
import { CashTransactionEntity } from './cash-transaction.entity';
import { AddTransactionDto } from './dto/add-transaction.dto';

@Injectable()
export class CashRegisterService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async withSchema<T>(tenantId: string, fn: (manager: EntityManager, qr: any) => Promise<T>): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager, qr);
    } finally {
      await qr.release();
    }
  }

  async open(tenantId: string, operatorId: string): Promise<CashSessionEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);

      const existing = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (existing) throw new BadRequestException('Já existe uma sessão de caixa aberta.');

      const lastClosed = await sessionRepo.findOne({
        where: { status: CashSessionStatus.CLOSED },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order: { closedAt: 'DESC' } as any,
      });

      const openingBalance = lastClosed?.closingBalance ?? 0;

      const session = sessionRepo.create({
        operatorId,
        openingBalance,
        status: CashSessionStatus.OPEN,
        openedAt: new Date(),
        closedBy: null,
        closedAt: null,
        closingBalance: null,
      });
      return sessionRepo.save(session);
    });
  }

  async close(tenantId: string, closedBy: string): Promise<CashSessionEntity> {
    return this.withSchema(tenantId, async (manager, qr) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const schemaName = this.getSchemaName(tenantId);

      await qr.startTransaction();
      try {
        const session = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
        if (!session) {
          throw new BadRequestException('Não há sessão de caixa aberta.');
        }

        const [cashInResult] = await qr.query(
          `SELECT COALESCE(SUM(amount), 0) as sum FROM "${schemaName}".cash_transactions WHERE cash_session_id = $1 AND type = 'IN' AND payment_method = 'CASH'`,
          [session.id],
        );
        const [cashOutResult] = await qr.query(
          `SELECT COALESCE(SUM(amount), 0) as sum FROM "${schemaName}".cash_transactions WHERE cash_session_id = $1 AND type = 'OUT' AND payment_method = 'CASH'`,
          [session.id],
        );

        const cashIn = Number(cashInResult.sum);
        const cashOut = Number(cashOutResult.sum);
        const closingBalance = Number(session.openingBalance) + cashIn - cashOut;

        Object.assign(session, {
          closedBy,
          closedAt: new Date(),
          closingBalance,
          status: CashSessionStatus.CLOSED,
        });
        const saved = await sessionRepo.save(session);
        await qr.commitTransaction();
        return saved;
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      }
    });
  }

  async getCurrent(tenantId: string): Promise<CashSessionEntity | null> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      return (await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } })) ?? null;
    });
  }

  async addTransaction(tenantId: string, dto: AddTransactionDto): Promise<CashTransactionEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const txRepo = manager.getRepository(CashTransactionEntity);

      const session = await sessionRepo.findOne({ where: { status: CashSessionStatus.OPEN } });
      if (!session) throw new BadRequestException('Não há sessão de caixa aberta.');

      const tx = txRepo.create({
        cashSessionId: session.id,
        type: dto.type,
        paymentMethod: dto.paymentMethod,
        amount: dto.amount,
        description: dto.description ?? null,
        referenceId: null,
        referenceType: null,
      });
      return txRepo.save(tx);
    });
  }

  async getTransactions(tenantId: string, sessionId: string): Promise<CashTransactionEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const sessionRepo = manager.getRepository(CashSessionEntity);
      const txRepo = manager.getRepository(CashTransactionEntity);

      const session = await sessionRepo.findOne({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sessão não encontrada.');

      return txRepo.find({
        where: { cashSessionId: session.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        order: { createdAt: 'ASC' } as any,
      });
    });
  }
}
