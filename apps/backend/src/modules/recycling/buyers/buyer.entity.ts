import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'buyers' })
export class BuyerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) document: string | null;
  @Column({ name: 'document_type', type: 'varchar', nullable: true })
  documentType: 'CPF' | 'CNPJ' | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
