import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'billing', schema: 'public' })
export class BillingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'tenant_id', unique: true })
  tenantId: string;

  @Column({ name: 'asaas_customer_id', nullable: true })
  asaasCustomerId: string;

  @Column({ name: 'asaas_subscription_id', nullable: true })
  asaasSubscriptionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
