import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'so_items_services' })
export class SoItemServiceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'so_id' }) soId: string;
  @Column({ name: 'catalog_service_id' }) catalogServiceId: string;
  @Column({ name: 'nome_servico' }) nomeServico: string;
  @Column({ type: 'numeric' }) valor: number;
  @Column({ name: 'mecanico_id', type: 'varchar', nullable: true }) mecanicoId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
