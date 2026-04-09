import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  CARD = 'CARD',
}

@Entity({ name: 'cash_transactions' })
export class CashTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cash_session_id', type: 'uuid' })
  cashSessionId: string;

  @Column({ type: 'varchar' })
  type: TransactionType;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
