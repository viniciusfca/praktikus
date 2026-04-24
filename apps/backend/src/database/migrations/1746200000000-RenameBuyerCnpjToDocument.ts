import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBuyerCnpjToDocument1746200000000 implements MigrationInterface {
  name = 'RenameBuyerCnpjToDocument1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );

    // Pre-check: any existing cnpj values must have exactly 14 digits.
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      const invalid: Array<{ id: string; cnpj: string }> = await queryRunner.query(
        `SELECT id, cnpj FROM "${schemaName}".buyers WHERE cnpj IS NOT NULL AND LENGTH(cnpj) <> 14`,
      );
      if (invalid.length > 0) {
        const list = invalid.map((r) => `${r.id} (cnpj=${r.cnpj})`).join(', ');
        throw new Error(
          `Cannot migrate: tenant ${tenant.id} has ${invalid.length} buyer(s) with invalid CNPJ length: ${list}`,
        );
      }
    }

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}".buyers RENAME COLUMN cnpj TO document`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}".buyers ADD COLUMN document_type VARCHAR(4)`,
      );
      await queryRunner.query(
        `UPDATE "${schemaName}".buyers SET document_type = 'CNPJ' WHERE document IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM "public"."tenants" WHERE segment = 'RECYCLING'`,
    );
    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      const cpfs: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM "${schemaName}".buyers WHERE document_type = 'CPF'`,
      );
      if (cpfs.length > 0) {
        throw new Error(
          `Cannot rollback: tenant ${tenant.id} has ${cpfs.length} buyer(s) with CPF — field cnpj cannot hold them.`,
        );
      }
      await queryRunner.query(`ALTER TABLE "${schemaName}".buyers DROP COLUMN document_type`);
      await queryRunner.query(
        `ALTER TABLE "${schemaName}".buyers RENAME COLUMN document TO cnpj`,
      );
    }
  }
}
