import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'purchase_items' })
export class PurchaseItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'purchase_id', type: 'uuid' }) purchaseId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) quantity: number;
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 4 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) subtotal: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
