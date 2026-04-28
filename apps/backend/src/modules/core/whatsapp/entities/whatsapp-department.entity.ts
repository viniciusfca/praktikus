import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface BusinessHoursDay {
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
}

export type BusinessHours = Partial<{
  mon: BusinessHoursDay;
  tue: BusinessHoursDay;
  wed: BusinessHoursDay;
  thu: BusinessHoursDay;
  fri: BusinessHoursDay;
  sat: BusinessHoursDay;
  sun: BusinessHoursDay;
}>;

@Entity({ name: 'whatsapp_departments' })
export class WhatsappDepartmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ name: 'business_hours', type: 'jsonb', nullable: true })
  businessHours: BusinessHours | null;

  @Column({ name: 'default_routing', type: 'boolean', default: false })
  defaultRouting: boolean;

  @Column({ name: 'routing_keywords', type: 'text', array: true, nullable: true })
  routingKeywords: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
