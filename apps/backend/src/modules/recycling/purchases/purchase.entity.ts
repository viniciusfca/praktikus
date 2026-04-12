import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { PaymentMethod } from '@praktikus/shared';

@Entity({ name: 'purchases' })
export class PurchaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'supplier_id', type: 'uuid' }) supplierId: string;
  @Column({ name: 'operator_id', type: 'uuid' }) operatorId: string;
  @Column({ name: 'cash_session_id', type: 'uuid', nullable: true }) cashSessionId: string | null;
  @Column({ name: 'payment_method', type: 'varchar' }) paymentMethod: PaymentMethod;
  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 }) totalAmount: number;
  @Column({ name: 'purchased_at', type: 'timestamptz', default: () => 'NOW()' }) purchasedAt: Date;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
