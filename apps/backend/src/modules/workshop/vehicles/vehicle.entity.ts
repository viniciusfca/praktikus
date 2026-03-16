import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'vehicles' })
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Column({ length: 7, unique: true })
  placa: string;

  @Column()
  marca: string;

  @Column()
  modelo: string;

  @Column({ type: 'integer' })
  ano: number;

  @Column({ type: 'integer', default: 0 })
  km: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
