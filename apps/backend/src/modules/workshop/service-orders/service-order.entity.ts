import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'service_orders' })
export class ServiceOrderEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'appointment_id', type: 'varchar', nullable: true }) appointmentId: string | null;
  @Column({ name: 'cliente_id' }) clienteId: string;
  @Column({ name: 'veiculo_id' }) veiculoId: string;
  @Column({ default: 'ORCAMENTO' }) status: string;
  @Column({ name: 'status_pagamento', default: 'PENDENTE' }) statusPagamento: string;
  @Column({ name: 'km_entrada', type: 'varchar', nullable: true }) kmEntrada: string | null;
  @Column({ type: 'varchar', nullable: true }) combustivel: string | null;
  @Column({ name: 'observacoes_entrada', type: 'text', nullable: true }) observacoesEntrada: string | null;
  @Column({ name: 'approval_token', type: 'uuid', nullable: true }) approvalToken: string | null;
  @Column({ name: 'approval_expires_at', type: 'timestamptz', nullable: true }) approvalExpiresAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
