import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get<string>('MAIL_FROM') ?? 'Praktikus <no-reply@praktikus.com.br>';
  }

  async sendPasswordReset(email: string, name: string, resetUrl: string): Promise<void> {
    if (!this.resend) {
      // eslint-disable-next-line no-console -- dev-only path; surfaces link to terminal
      console.log(`[mail dev] password reset for ${email}: ${resetUrl}`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Recuperação de senha — Praktikus',
        html: this.passwordResetHtml(name, resetUrl),
      });
      if (error) {
        this.logger.warn(`Resend error sending reset to ${email}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`Exception sending reset to ${email}: ${(err as Error).message}`);
    }
  }

  async sendPasswordChangedConfirmation(email: string, name: string): Promise<void> {
    if (!this.resend) {
      // eslint-disable-next-line no-console -- dev-only path
      console.log(`[mail dev] password changed for ${email} (${name})`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Sua senha foi alterada — Praktikus',
        html: this.passwordChangedHtml(name),
      });
      if (error) {
        this.logger.warn(`Resend error sending confirmation to ${email}: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(`Exception sending confirmation to ${email}: ${(err as Error).message}`);
    }
  }

  private passwordResetHtml(name: string, resetUrl: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: -apple-system, system-ui, sans-serif; background:#f7f8f8; padding:32px; color:#0c1010;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e3e7e7;">
    <h1 style="margin:0 0 16px; font-size:20px; color:#0c1010;">Praktikus</h1>
    <p>Olá, ${escapeHtml(name)}.</p>
    <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
    <p style="text-align:center; margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block; background:#348E91; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
        Redefinir senha
      </a>
    </p>
    <p style="font-size:13px; color:#5b6868;">Este link é válido por 1 hora. Se você não solicitou essa redefinição, ignore este e-mail — sua senha permanece inalterada.</p>
    <p style="font-size:12px; color:#94a3a3; margin-top:24px;">Se o botão não funcionar, copie e cole este link no navegador:<br/>${resetUrl}</p>
  </div>
</body>
</html>`;
  }

  private passwordChangedHtml(name: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: -apple-system, system-ui, sans-serif; background:#f7f8f8; padding:32px; color:#0c1010;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e3e7e7;">
    <h1 style="margin:0 0 16px; font-size:20px; color:#0c1010;">Praktikus</h1>
    <p>Olá, ${escapeHtml(name)}.</p>
    <p>Sua senha foi alterada com sucesso. Se não foi você, entre em contato com o suporte imediatamente.</p>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
