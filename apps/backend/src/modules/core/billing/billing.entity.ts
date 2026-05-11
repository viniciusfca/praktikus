import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'billing', schema: 'public' })
export class BillingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', unique: true, type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asaas_customer_id', type: 'varchar', nullable: true })
  asaasCustomerId: string | null;

  @Column({ name: 'asaas_subscription_id', type: 'varchar', nullable: true })
  asaasSubscriptionId: string | null;

  @Column({ name: 'billing_type', type: 'varchar', length: 20, nullable: true })
  billingType: 'PIX' | 'CREDIT_CARD' | null;

  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'card_brand', type: 'varchar', length: 20, nullable: true })
  cardBrand: string | null;

  @Column({ name: 'card_expiry', type: 'varchar', length: 5, nullable: true })
  cardExpiry: string | null;

  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
