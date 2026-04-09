import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CashSessionStatus } from '@praktikus/shared';

@Entity({ name: 'cash_sessions' })
export class CashSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string | null;

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'NOW()' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'opening_balance', type: 'numeric', precision: 12, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ name: 'closing_balance', type: 'numeric', precision: 12, scale: 2, nullable: true })
  closingBalance: number | null;

  @Column({ type: 'varchar', default: CashSessionStatus.OPEN })
  status: CashSessionStatus;
}
