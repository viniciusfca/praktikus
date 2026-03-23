import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'so_items_parts' })
export class SoItemPartEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'so_id' }) soId: string;
  @Column({ name: 'catalog_part_id' }) catalogPartId: string;
  @Column({ name: 'nome_peca' }) nomePeca: string;
  @Column({ type: 'int' }) quantidade: number;
  @Column({ name: 'valor_unitario', type: 'numeric' }) valorUnitario: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
