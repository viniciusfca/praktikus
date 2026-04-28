import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappAccountStatus } from '@praktikus/shared';

@Entity({ name: 'whatsapp_accounts' })
export class WhatsappAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number_id', type: 'varchar' })
  phoneNumberId: string;

  @Column({ name: 'waba_id', type: 'varchar' })
  wabaId: string;

  @Column({ name: 'display_phone', type: 'varchar' })
  displayPhone: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'webhook_verify_token', type: 'varchar' })
  webhookVerifyToken: string;

  @Column({
    type: 'enum',
    enum: WhatsappAccountStatus,
    default: WhatsappAccountStatus.PENDING,
  })
  status: WhatsappAccountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
