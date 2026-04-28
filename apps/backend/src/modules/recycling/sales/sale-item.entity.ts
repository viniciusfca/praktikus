import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../common/numeric-transformer';

@Entity({ name: 'sale_items' })
export class SaleItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'sale_id', type: 'uuid' }) saleId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  quantity: number;
  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  unitPrice: number;
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  subtotal: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
