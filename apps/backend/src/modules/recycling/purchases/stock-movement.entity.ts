import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum MovementType { IN = 'IN', OUT = 'OUT' }

@Entity({ name: 'stock_movements' })
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ type: 'varchar' }) type: MovementType;
  @Column({ type: 'numeric', precision: 10, scale: 4 }) quantity: number;
  @Column({ name: 'reference_id', type: 'uuid', nullable: true }) referenceId: string | null;
  @Column({ name: 'reference_type', type: 'varchar', nullable: true }) referenceType: string | null;
  @Column({ name: 'moved_at', type: 'timestamptz', default: () => 'NOW()' }) movedAt: Date;
}
