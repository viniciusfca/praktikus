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
      mockResendSend.mockResolvedValue({
        data: null,
        error: { message: 'rate limited' },
      });
      const module: TestingModule = await buildModule({
        RESEND_API_KEY: 'rk_test',
      });
      const service = module.get<MailService>(MailService);

      await expect(
        service.sendPasswordReset('a@b.com', 'João', 'http://x/r/abc'),
      ).resolves.toBeUndefined();
    });
  });

  describe('billing emails', () => {
    let service: MailService;

    beforeEach(async () => {
      const module: TestingModule = await buildModule({
        RESEND_API_KEY: 'rk_test',
        MAIL_FROM: 'Praktikus <no-reply@praktikus.com.br>',
      });
      service = module.get<MailService>(MailService);
    });

    it('sendTrialExpiringWarning sends email with daysLeft and CTA url', async () => {
      await service.sendTrialExpiringWarning(
        'a@b.com',
        'Foo',
        7,
        'https://app/x',
      );

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.to).toBe('a@b.com');
      expect(payload.subject).toMatch(/7 dias/);
      expect(payload.html).toContain('https://app/x');
      expect(payload.html).toContain('Foo');
    });

    it('sendTrialExpiringTomorrow sends email with tomorrow subject and CTA url', async () => {
      await service.sendTrialExpiringTomorrow(
        'a@b.com',
        'Foo',
        'https://app/y',
      );

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.to).toBe('a@b.com');
      expect(payload.subject).toMatch(/amanhã/);
      expect(payload.html).toContain('https://app/y');
    });

    it('sendAccountSuspended sends email with suspension subject and CTA url', async () => {
      await service.sendAccountSuspended('a@b.com', 'Foo', 'https://app/z');

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.to).toBe('a@b.com');
      expect(payload.subject).toMatch(/suspensa/i);
      expect(payload.html).toContain('https://app/z');
    });

    it('sendPaymentRefundIssue sends email with refund subject and CTA url', async () => {
      await service.sendPaymentRefundIssue('a@b.com', 'Foo', 'https://app/w');

      expect(mockResendSend).toHaveBeenCalledTimes(1);
      const payload = mockResendSend.mock.calls[0][0];
      expect(payload.to).toBe('a@b.com');
      expect(payload.subject).toMatch(/problema com seu pagamento/i);
      expect(payload.html).toContain('https://app/w');
    });
  });
});
