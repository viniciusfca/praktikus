import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';
import { WhatsappRoleInDept } from '@praktikus/shared';

@Entity({ name: 'whatsapp_department_users' })
@Index('uq_dept_user', ['departmentId', 'userId'], { unique: true })
export class WhatsappDepartmentUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'role_in_dept',
    type: 'varchar',
    default: WhatsappRoleInDept.AGENT,
  })
  roleInDept: WhatsappRoleInDept;
}
