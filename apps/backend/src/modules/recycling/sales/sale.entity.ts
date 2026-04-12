import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'sales' })
export class SaleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'buyer_id', type: 'uuid' }) buyerId: string;
  @Column({ name: 'operator_id', type: 'uuid' }) operatorId: string;
  @Column({ name: 'sold_at', type: 'timestamptz', default: () => 'NOW()' }) soldAt: Date;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
