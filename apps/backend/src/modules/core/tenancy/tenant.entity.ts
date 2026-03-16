import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TenantStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  OVERDUE = 'OVERDUE',
  SUSPENDED = 'SUSPENDED',
}

export type TenantAddress = {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
};

@Entity({ name: 'tenants', schema: 'public' })
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  slug: string;

  @Column({ name: 'schema_name', unique: true })
  schemaName: string;

  @Index({ unique: true })
  @Column({ unique: true })
  cnpj: string;

  @Column({ name: 'razao_social' })
  razaoSocial: string;

  @Column({ name: 'nome_fantasia' })
  nomeFantasia: string;

  @Column({ type: 'jsonb', nullable: true })
  endereco: TenantAddress | null;

  @Column({ nullable: true })
  telefone: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.TRIAL,
  })
  status: TenantStatus;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ name: 'billing_anchor_date', type: 'date', nullable: true })
  billingAnchorDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
