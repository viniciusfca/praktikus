import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsappConversationStatus } from '@praktikus/shared';

@Entity({ name: 'whatsapp_conversations' })
@Index('idx_conversations_phone', ['contactPhone'])
@Index('idx_conversations_status', ['status'])
export class WhatsappConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contact_phone', type: 'varchar' })
  contactPhone: string;

  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({
    type: 'enum',
    enum: WhatsappConversationStatus,
    default: WhatsappConversationStatus.OPEN,
  })
  status: WhatsappConversationStatus;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'window_expires_at', type: 'timestamptz', nullable: true })
  windowExpiresAt: Date | null;

  @Column({ name: 'linked_customer_id', type: 'uuid', nullable: true })
  linkedCustomerId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
