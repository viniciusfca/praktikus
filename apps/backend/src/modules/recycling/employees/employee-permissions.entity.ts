import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'employee_permissions' })
export class EmployeePermissionsEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'can_manage_suppliers', default: true })
  canManageSuppliers: boolean;

  @Column({ name: 'can_manage_buyers', default: false })
  canManageBuyers: boolean;

  @Column({ name: 'can_manage_products', default: false })
  canManageProducts: boolean;

  @Column({ name: 'can_open_close_cash', default: true })
  canOpenCloseCash: boolean;

  @Column({ name: 'can_view_stock', default: true })
  canViewStock: boolean;

  @Column({ name: 'can_view_reports', default: false })
  canViewReports: boolean;

  @Column({ name: 'can_register_purchases', default: true })
  canRegisterPurchases: boolean;

  @Column({ name: 'can_register_sales', default: true })
  canRegisterSales: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
