import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type SupplierAddress = {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
};

@Entity({ name: 'suppliers' })
export class SupplierEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  document: string | null;

  @Column({ name: 'document_type', type: 'varchar', nullable: true })
  documentType: 'CPF' | 'CNPJ' | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address: SupplierAddress | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
