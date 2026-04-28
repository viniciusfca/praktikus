import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mockResendSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => mockResendSend(...args) },
  })),
}));

function buildModule(env: Record<string, string | undefined>) {
  return Test.createTestingModule({
    providers: [
      MailService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => env[key] },
      },
    ],
  }).compile();
}

describe('MailService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    mockResendSend.mockReset();
    mockResendSend.mockResolvedValue({ data: { id: 'mock-id' }, error: null });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('dev mode (no RESEND_API_KEY)', () => {
    it('logs reset URL instead of sending email', async () => {
      const module: TestingModule = await buildModule({});
      const service = module.get<MailService>(MailService);

      await service.sendPasswordReset('a@b.com', 'João', 'http://x/reset/abc');

      expect(mockResendSend).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('http://x/reset/abc'),
      );
    });

    it('logs password-changed confirmation in dev mode', async () => {
      const module: TestingModule = await buildModule({});
      const service = module.get<MailService>(MailService);

      await service.sendPasswordChangedConfirmation('a@b.com', 'João');

      expect(mockResendSend).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('a@b.com'));
    });
  });

  describe('prod mode (with RESEND_API_KEY)', () => {
    it('calls Resend with reset email payload', async () => {
      const module: TestingModule = await buildModule({
        RESEND_API_KEY: 'rk_test',
        MAIL_FROM: 'Praktikus <no-reply@praktikus.com.br>',
      });
      const service = module.get<MailService>(MailService);

      await service.sendPasswordReset('a@b.com', 'João', 'http://x/reset/abc');

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.from).toBe('Praktikus <no-reply@praktikus.com.br>');
      expect(payload.to).toBe('a@b.com');
      expect(payload.subject).toMatch(/recupera/i);
      expect(payload.html).toContain('http://x/reset/abc');
      expect(payload.html).toContain('João');
    });

    it('does not throw when Resend returns an error', async () => {
      mockResendSend.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
      const module: TestingModule = await buildModule({ RESEND_API_KEY: 'rk_test' });
      const service = module.get<MailService>(MailService);

      await expect(
        service.sendPasswordReset('a@b.com', 'João', 'http://x/r/abc'),
      ).resolves.toBeUndefined();
    });
  });
});
