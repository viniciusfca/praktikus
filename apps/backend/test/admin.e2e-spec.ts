import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PlatformUserEntity } from '../src/modules/core/admin/admin-auth/platform-user.entity';

describe('Admin endpoints (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const TEST_EMAIL = 'e2e-platform@test.local';
  const TEST_PASSWORD = 'e2e_test_password_123';
  let platformAccessToken: string;
  let tenantAccessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    ds = app.get(DataSource);

    // Seed um platform_user dedicado pra esse teste
    const repo = ds.getRepository(PlatformUserEntity);
    await repo.delete({ email: TEST_EMAIL });
    await repo.save({
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      name: 'E2E Tester',
      role: 'PLATFORM_OWNER',
    });
  });

  afterAll(async () => {
    if (ds) {
      await ds
        .getRepository(PlatformUserEntity)
        .delete({ email: TEST_EMAIL });
    }
    await app.close();
  });

  it('POST /api/admin/auth/login devolve tokens válidos', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    platformAccessToken = res.body.access_token;
  });

  it('POST /api/admin/auth/login rejeita senha errada', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrong_password' })
      .expect(401);
  });

  it.each([
    '/api/admin/overview',
    '/api/admin/tenants',
    '/api/admin/segments',
    '/api/admin/whatsapp',
    '/api/admin/financial',
  ])('GET %s autentica com platform JWT', async (path) => {
    const res = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${platformAccessToken}`)
      .expect(200);
    expect(res.body).toBeDefined();
  });

  it('GET /api/admin/overview rejeita sem token', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .expect(401);
  });

  it('GET /api/admin/overview rejeita JWT de tenant', async () => {
    // Cria um tenant + user via fluxo real só se ainda não existir token
    // Usa CNPJ válido e senha forte para passar validação do DTO
    const TENANT_EMAIL = 'e2e-tenant@test.local';
    const TENANT_PASSWORD = 'E2eTenant@123'; // NOSONAR(rule:S2068) — senha de teste e2e, não é credencial real
    if (!tenantAccessToken) {
      const reg = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          cnpj: '11.222.333/0001-81',
          razaoSocial: 'E2E Tenant LTDA',
          nomeFantasia: 'E2E Tenant',
          email: TENANT_EMAIL,
          password: TENANT_PASSWORD,
          ownerName: 'E2E Owner',
          segment: 'WORKSHOP',
        });
      // Se já existir (re-run), faz login
      if (reg.status === 201 || reg.status === 200) {
        tenantAccessToken = reg.body.access_token;
      } else {
        const log = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: TENANT_EMAIL,
            password: TENANT_PASSWORD,
          })
          .expect(200);
        tenantAccessToken = log.body.access_token;
      }
    }
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${tenantAccessToken}`)
      .expect(401);
  });

  it('GET /api/auth/me rejeita JWT de plataforma (defesa em profundidade)', async () => {
    // Endpoint de tenant qualquer protegido por JwtAuthGuard. Use um existente.
    // Se /api/auth/me não existir, troque por /api/customers ou outro.
    await request(app.getHttpServer())
      .patch('/api/auth/me/password')
      .set('Authorization', `Bearer ${platformAccessToken}`)
      .send({ currentPassword: 'x', newPassword: 'y' })
      .expect(401);
  });

  it('POST /api/admin/auth/logout invalida o refresh token', async () => {
    const log = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/admin/auth/logout')
      .set('Authorization', `Bearer ${log.body.access_token}`)
      .send({ refresh_token: log.body.refresh_token })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/admin/auth/refresh')
      .send({ refresh_token: log.body.refresh_token })
      .expect(401);
  });
});
