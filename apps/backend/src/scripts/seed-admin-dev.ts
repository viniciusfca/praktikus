import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'node:path';

// Load backend .env explicitly (data-source.ts loads apps/.env which may not exist when running standalone)
dotenv.config({ path: join(__dirname, '../../.env') });

import * as bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { AppDataSource } from '../database/data-source';
import { PlatformUserEntity } from '../modules/core/admin/admin-auth/platform-user.entity';
import { TenantEntity, TenantStatus } from '../modules/core/tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';

const UFS = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'PE', 'CE',
  'DF', 'ES', 'PA', 'AM', 'MT',
];

const CITIES_BY_UF: Record<string, string[]> = {
  SP: ['São Paulo', 'Campinas', 'Santos'],
  RJ: ['Rio de Janeiro', 'Niterói'],
  MG: ['Belo Horizonte', 'Uberlândia'],
  RS: ['Porto Alegre', 'Caxias'],
  PR: ['Curitiba', 'Londrina'],
  SC: ['Florianópolis', 'Joinville'],
  BA: ['Salvador'],
  GO: ['Goiânia'],
  PE: ['Recife'],
  CE: ['Fortaleza'],
  DF: ['Brasília'],
  ES: ['Vitória'],
  PA: ['Belém'],
  AM: ['Manaus'],
  MT: ['Cuiabá'],
};

function randomDate(daysAgoMin: number, daysAgoMax: number): Date {
  const span = daysAgoMax - daysAgoMin;
  const offset = Math.floor(Math.random() * span) + daysAgoMin;
  return new Date(Date.now() - offset * 86_400_000);
}

function pickStatus(): TenantStatus {
  const r = Math.random();
  if (r < 0.6) return TenantStatus.ACTIVE;
  if (r < 0.85) return TenantStatus.TRIAL;
  if (r < 0.93) return TenantStatus.OVERDUE;
  return TenantStatus.SUSPENDED;
}

function pickWhatsappPlan(): string {
  const r = Math.random();
  if (r < 0.6) return 'STARTER';
  if (r < 0.85) return 'PRO';
  return 'ENTERPRISE';
}

function buildTrialEndsAt(status: TenantStatus): Date | null {
  if (status !== TenantStatus.TRIAL) return null;
  const daysAhead =
    Math.random() < 0.3
      ? Math.floor(Math.random() * 7) + 1
      : Math.floor(Math.random() * 30) + 7;
  return new Date(Date.now() + daysAhead * 86_400_000);
}

function buildFakeTenant(i: number): Partial<TenantEntity> {
  const status = pickStatus();
  const segment =
    Math.random() < 0.7 ? TenantSegment.WORKSHOP : TenantSegment.RECYCLING;
  const uf = faker.helpers.arrayElement(UFS);
  const city = faker.helpers.arrayElement(CITIES_BY_UF[uf]);
  const wppEnabled = Math.random() < 0.4;
  const trialEndsAt = buildTrialEndsAt(status);

  const cnpj = faker.string.numeric(14).replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5',
  );

  const idx = String(i).padStart(3, '0');

  return {
    slug: `seed-${idx}-${faker.string.alphanumeric(6).toLowerCase()}`,
    schemaName: `tenant_seed_${idx}_${faker.string.alphanumeric(8).toLowerCase()}`,
    cnpj,
    razaoSocial: `${faker.company.name()} LTDA`,
    nomeFantasia: faker.company.name(),
    endereco: {
      street: faker.location.street(),
      number: String(faker.number.int({ min: 1, max: 9999 })),
      city,
      state: uf,
      zip: faker.location.zipCode('########'),
    },
    telefone: faker.phone.number(),
    status,
    segment,
    whatsappEnabled: wppEnabled,
    whatsappPlan: wppEnabled ? (pickWhatsappPlan() as any) : null,
    trialEndsAt,
    createdAt: randomDate(0, 180),
    updatedAt: new Date(),
  };
}

async function upsertPlatformOwner(ownerEmail: string, ownerPassword: string): Promise<void> {
  const userRepo = AppDataSource.getRepository(PlatformUserEntity);
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const existing = await userRepo.findOne({ where: { email: ownerEmail } });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = existing.name || 'Platform Owner';
    await userRepo.save(existing);
    console.log(`[seed] Updated platform_user ${ownerEmail}`);
  } else {
    await userRepo.save({
      email: ownerEmail,
      passwordHash,
      name: 'Platform Owner',
      role: 'PLATFORM_OWNER',
    });
    console.log(`[seed] Created platform_user ${ownerEmail}`);
  }
}

async function seedFakeTenants(): Promise<void> {
  // Distribuição alvo: 60% ACTIVE, 25% TRIAL, 8% OVERDUE, 7% SUSPENDED
  // 70% WORKSHOP, 30% RECYCLING
  // 40% whatsappEnabled, distribuídos entre STARTER (60%), PRO (25%), ENTERPRISE (15%)
  const tenantRepo = AppDataSource.getRepository(TenantEntity);
  const tenantCount = await tenantRepo.count();

  if (tenantCount >= 20) {
    console.log(
      `[seed] Tenants count = ${tenantCount} (>= 20). Skipping fake tenants.`,
    );
    return;
  }

  console.log(`[seed] Tenants count = ${tenantCount}. Creating fakes...`);
  const TARGET = 80;
  const toCreate = TARGET - tenantCount;

  const fakes: Partial<TenantEntity>[] = [];
  for (let i = 0; i < toCreate; i++) {
    fakes.push(buildFakeTenant(i));
  }

  // Bulk insert (não cria schemas/tabelas internas — esses tenants são "metadata-only" pro admin)
  await tenantRepo.insert(fakes as any[]);
  console.log(`[seed] Inserted ${fakes.length} fake tenants`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-admin-dev refuses to run with NODE_ENV=production');
  }

  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;
  const ownerPassword = process.env.PLATFORM_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD must be set in .env',
    );
  }

  await AppDataSource.initialize();
  console.log('[seed] DataSource initialized');

  await upsertPlatformOwner(ownerEmail, ownerPassword);
  await seedFakeTenants();

  await AppDataSource.destroy();
  console.log('[seed] Done.');
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
