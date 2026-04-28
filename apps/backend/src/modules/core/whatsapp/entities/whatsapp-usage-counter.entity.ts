import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'whatsapp_usage_counters' })
export class WhatsappUsageCounterEntity {
  @PrimaryColumn({ name: 'year_month', type: 'char', length: 7 })
  yearMonth: string;

  @Column({ name: 'service_conversations', type: 'int', default: 0 })
  serviceConversations: number;

  @Column({ name: 'utility_conversations', type: 'int', default: 0 })
  utilityConversations: number;

  @Column({ name: 'marketing_conversations', type: 'int', default: 0 })
  marketingConversations: number;

  @Column({ name: 'authentication_conversations', type: 'int', default: 0 })
  authenticationConversations: number;
}
