import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantSegment } from '@praktikus/shared';

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

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'schema_name', unique: true })
  schemaName: string;

  @Column({ unique: true })
  cnpj: string;

  @Column({ name: 'razao_social' })
  razaoSocial: string;

  @Column({ name: 'nome_fantasia' })
  nomeFantasia: string;

  @Column({ type: 'jsonb', nullable: true })
  endereco: TenantAddress | null;

  @Column({ type: 'varchar', nullable: true })
  telefone: string | null;

  @Column({ name: 'logo_url', type: 'varchar', nullable: true })
  logoUrl: string | null;

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

  @Column({
    type: 'varchar',
    default: TenantSegment.WORKSHOP,
  })
  segment: TenantSegment;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
