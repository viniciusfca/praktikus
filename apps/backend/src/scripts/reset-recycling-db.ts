import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

dotenv.config({ path: join(__dirname, '../../.env') });

import { AppDataSource } from '../database/data-source';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const DB_NAME = process.env.DB_NAME ?? 'praktikus';

async function listTenantSchemas(): Promise<string[]> {
  const rows: Array<{ schema_name: string }> = await AppDataSource.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  `);
  return rows.map((r) => r.schema_name);
}

async function main(): Promise<void> {
  if (NODE_ENV === 'production') {
    console.error('[reset-db] BLOCKED — refusing to reset DB in NODE_ENV=production.');
    process.exit(1);
  }

  console.log(`[reset-db] Resetting DB "${DB_NAME}" (NODE_ENV=${NODE_ENV})...`);

  // 1) Init connection
  await AppDataSource.initialize();
  console.log('[reset-db] DataSource initialized');

  // 2) Drop tenant schemas (per-tenant data)
  const tenantSchemas = await listTenantSchemas();
  for (const schema of tenantSchemas) {
    await AppDataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log(`[reset-db] Dropped tenant schema: ${schema}`);
  }

  // 3) Drop and recreate public schema (wipes all public.* tables incl. migrations)
  await AppDataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
  await AppDataSource.query('CREATE SCHEMA public');
  console.log('[reset-db] Public schema dropped + recreated');

  // 4) Close and re-init so TypeORM picks up the empty schema
  await AppDataSource.destroy();
  await AppDataSource.initialize();

  // 5) Run all migrations
  const executed = await AppDataSource.runMigrations();
  console.log(`[reset-db] Ran ${executed.length} migrations`);

  await AppDataSource.destroy();
  console.log('[reset-db] Done. DB is empty + migrated. Ready for fresh signup.');
}

main().catch((err) => {
  console.error('[reset-db] FAILED:', err);
  process.exit(1);
});
