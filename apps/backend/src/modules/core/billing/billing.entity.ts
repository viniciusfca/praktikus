import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'billing', schema: 'public' })
export class BillingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', unique: true, type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asaas_customer_id', nullable: true })
  asaasCustomerId: string | null;

  @Column({ name: 'asaas_subscription_id', nullable: true })
  asaasSubscriptionId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
