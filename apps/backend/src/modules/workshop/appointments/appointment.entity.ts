import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'appointments' })
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cliente_id' })
  clienteId: string;

  @Column({ name: 'veiculo_id' })
  veiculoId: string;

  @Column({ name: 'data_hora', type: 'timestamptz' })
  dataHora: Date;

  @Column({ name: 'duracao_min', default: 60 })
  duracaoMin: number;

  @Column({ name: 'tipo_servico', nullable: true })
  tipoServico: string | null;

  @Column({ default: 'PENDENTE' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
