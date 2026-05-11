import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvoiceStatus, BillingType } from '@praktikus/shared';

@Entity({ name: 'billing_invoices', schema: 'public' })
@Index(['tenantId', 'status'])
export class BillingInvoiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asaas_payment_id', type: 'varchar', length: 64, unique: true })
  asaasPaymentId: string;

  /** Stored as string to preserve numeric(10,2) precision; convert with parseFloat at use sites. */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  value: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ type: 'varchar', length: 20 })
  status: InvoiceStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'billing_type', type: 'varchar', length: 20 })
  billingType: BillingType;

  @Column({ name: 'pix_qr_code', type: 'text', nullable: true })
  pixQrCode: string | null;

  @Column({ name: 'pix_copy_paste', type: 'text', nullable: true })
  pixCopyPaste: string | null;

  @Column({ name: 'pix_expires_at', type: 'timestamptz', nullable: true })
  pixExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
