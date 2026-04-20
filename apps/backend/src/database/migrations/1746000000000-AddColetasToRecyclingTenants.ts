import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColetasToRecyclingTenants1746000000000 implements MigrationInterface {
  name = 'AddColetasToRecyclingTenants1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".coletas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supplier_id UUID NOT NULL REFERENCES "${schemaName}".suppliers(id) ON DELETE RESTRICT,
          employee_id UUID,
          scheduled_at TIMESTAMPTZ NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'AGENDADA',
          notes VARCHAR,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coletas_scheduled_at ON "${schemaName}".coletas(scheduled_at)`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_coletas_status ON "${schemaName}".coletas(status)`);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".coleta_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          coleta_id UUID NOT NULL REFERENCES "${schemaName}".coletas(id) ON DELETE CASCADE,
          texto VARCHAR NOT NULL,
          created_by_id UUID NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await queryRunner.query(`
        ALTER TABLE "${schemaName}".employee_permissions
        ADD COLUMN IF NOT EXISTS can_manage_coletas BOOLEAN NOT NULL DEFAULT true
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(`ALTER TABLE "${schemaName}".employee_permissions DROP COLUMN IF EXISTS can_manage_coletas`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schemaName}".coleta_comments`);
      await queryRunner.query(`DROP TABLE IF EXISTS "${schemaName}".coletas`);
    }
  }
}
