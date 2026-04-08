import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

describe('Database Connection', () => {
  it('should connect to PostgreSQL successfully', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ envFilePath: '../../apps/backend/.env' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'praktikus',
          password: process.env.DB_PASS ?? 'praktikus_dev',
          database: process.env.DB_NAME ?? 'praktikus',
          entities: [],
          synchronize: false,
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
