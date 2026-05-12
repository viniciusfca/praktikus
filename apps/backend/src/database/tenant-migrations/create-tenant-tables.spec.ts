import { TenantSegment } from '@praktikus/shared';
import { createTenantTablesSql } from './create-tenant-tables';

const SCHEMA = 'tenant_test123';

describe('createTenantTablesSql', () => {
  describe('segment RECYCLING', () => {
    const sqls = createTenantTablesSql(SCHEMA, TenantSegment.RECYCLING);

    it('contains a CREATE TABLE statement for units', () => {
      const hasCreateUnits = sqls.some((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS "${SCHEMA}".units`),
      );
      expect(hasCreateUnits).toBe(true);
    });

    it('contains exactly 2 INSERT INTO units statements (Quilograma + Unidade)', () => {
      const inserts = sqls.filter((sql) =>
        sql.includes(`INSERT INTO "${SCHEMA}".units`),
      );
      expect(inserts).toHaveLength(2);
    });

    it('inserts Quilograma (kg) and Unidade (unid)', () => {
      const all = sqls.join('\n');
      expect(all).toMatch(/'Quilograma'\s*,\s*'kg'/);
      expect(all).toMatch(/'Unidade'\s*,\s*'unid'/);
    });

    it('runs INSERT INTO units AFTER the CREATE TABLE units', () => {
      const createIdx = sqls.findIndex((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS "${SCHEMA}".units`),
      );
      const firstInsertIdx = sqls.findIndex((sql) =>
        sql.includes(`INSERT INTO "${SCHEMA}".units`),
      );
      expect(createIdx).toBeGreaterThanOrEqual(0);
      expect(firstInsertIdx).toBeGreaterThan(createIdx);
    });
  });

  describe('segment WORKSHOP', () => {
    const sqls = createTenantTablesSql(SCHEMA, TenantSegment.WORKSHOP);

    it('does NOT create a units table (Workshop has no units concept)', () => {
      const hasCreateUnits = sqls.some((sql) =>
        sql.includes(`CREATE TABLE IF NOT EXISTS "${SCHEMA}".units`),
      );
      expect(hasCreateUnits).toBe(false);
    });

    it('does NOT contain any INSERT INTO units statements', () => {
      const hasUnitsInsert = sqls.some((sql) =>
        sql.includes(`INSERT INTO "${SCHEMA}".units`),
      );
      expect(hasUnitsInsert).toBe(false);
    });
  });
});
