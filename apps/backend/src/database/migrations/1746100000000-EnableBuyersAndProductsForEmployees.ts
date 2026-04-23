import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableBuyersAndProductsForEmployees1746100000000 implements MigrationInterface {
  name = 'EnableBuyersAndProductsForEmployees1746100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      await queryRunner.query(`
        ALTER TABLE "${schemaName}".employee_permissions
          ALTER COLUMN can_manage_buyers SET DEFAULT true,
          ALTER COLUMN can_manage_products SET DEFAULT true
      `);

      await queryRunner.query(`
        UPDATE "${schemaName}".employee_permissions
        SET can_manage_buyers = true,
            can_manage_products = true
        WHERE can_manage_buyers = false
           OR can_manage_products = false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`
        ALTER TABLE "${schemaName}".employee_permissions
          ALTER COLUMN can_manage_buyers SET DEFAULT false,
          ALTER COLUMN can_manage_products SET DEFAULT false
      `);
    }
  }
}
