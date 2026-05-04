import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  WhatsappBillableCategory,
  WhatsappMessageDirection,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from '@praktikus/shared';

@Entity({ name: 'whatsapp_messages' })
@Index('uq_messages_wamid', ['wamid'], { unique: true })
@Index('idx_messages_conversation', ['conversationId'])
export class WhatsappMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar' })
  wamid: string;

  @Column({ type: 'varchar' })
  direction: WhatsappMessageDirection;

  @Column({ type: 'varchar' })
  type: WhatsappMessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'template_name', type: 'varchar', nullable: true })
  templateName: string | null;

  @Column({ type: 'varchar', default: WhatsappMessageStatus.SENT })
  status: WhatsappMessageStatus;

  @Column({ name: 'billable_category', type: 'varchar', nullable: true })
  billableCategory: WhatsappBillableCategory | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
