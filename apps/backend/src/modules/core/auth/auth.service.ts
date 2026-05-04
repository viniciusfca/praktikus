import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity, UserRole } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { PasswordResetTokenEntity } from './password-reset-token.entity';
import { MailService } from '../mail/mail.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { TenantStatus } from '../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';
import { BillingService } from '../billing/billing.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetTokenRepo: Repository<PasswordResetTokenEntity>,
    private readonly tenancyService: TenancyService,
    private readonly billingService: BillingService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    // Check uniqueness BEFORE starting transaction (avoids holding locks during slug generation)
    const existingTenant = await this.tenancyService.findByCnpj(dto.cnpj);
    if (existingTenant) {
      throw new ConflictException('CNPJ já cadastrado.');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    // Transactional: create tenant + user atomically
    const { tenant, user } = await this.dataSource.transaction(
      async (manager) => {
        const tenant = await this.tenancyService.createTenantWithManager(
          {
            cnpj: dto.cnpj,
            razaoSocial: dto.razaoSocial,
            nomeFantasia: dto.nomeFantasia,
            telefone: dto.telefone,
            endereco: dto.endereco,
            segment: dto.segment,
          },
          manager,
        );

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = manager.create(UserEntity, {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          name: dto.ownerName,
          role: UserRole.OWNER,
        });
        const savedUser = await manager.save(user);

        return { tenant, user: savedUser };
      },
    );

    // Billing is OUTSIDE the transaction (external API, cannot roll back Asaas)
    // If this fails, tenant + user exist but without billing. The user can still log in
    // and billing can be retried via a separate flow.
    await this.billingService.setupTrial(
      tenant.id,
      dto.email,
      dto.nomeFantasia,
    );

    return this.generateTokens(
      user,
      tenant.status,
      tenant.segment,
      tenant.whatsappEnabled,
    );
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.buildTokensForUser(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    stored.revoked = true;
    await this.refreshTokenRepo.save(stored);

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.buildTokensForUser(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    await this.refreshTokenRepo.update({ tokenHash }, { revoked: true });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      // Anti-enumeration: silent no-op when the email is not registered.
      return;
    }

    // Invalidate previous active tokens for this user.
    await this.resetTokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.resetTokenRepo.save({
      userId: user.id,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    const baseUrl =
      this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    await this.mail.sendPasswordReset(user.email, user.name, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await this.resetTokenRepo.findOne({ where: { tokenHash } });

    const now = new Date();
    if (!record || record.usedAt !== null || record.expiresAt <= now) {
      throw new BadRequestException('Link inválido ou expirado.');
    }

    const user = await this.userRepo.findOne({ where: { id: record.userId } });
    if (!user) {
      throw new BadRequestException('Link inválido ou expirado.');
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await this.dataSource.transaction(async (manager) => {
      user.passwordHash = newHash;
      await manager.save(UserEntity, user);
      await manager.update(PasswordResetTokenEntity, record.id, {
        usedAt: new Date(),
      });
      await manager.delete(RefreshTokenEntity, { userId: user.id });
    });

    // Fire-and-forget confirmation email (errors are logged inside MailService).
    void this.mail.sendPasswordChangedConfirmation(user.email, user.name);
  }

  private async buildTokensForUser(user: UserEntity): Promise<AuthTokens> {
    const tenant = await this.tenancyService.findById(user.tenantId);
    return this.generateTokens(
      user,
      tenant?.status ?? TenantStatus.ACTIVE,
      tenant?.segment,
      tenant?.whatsappEnabled,
    );
  }

  private async generateTokens(
    user: UserEntity,
    tenantStatus: string,
    tenantSegment?: TenantSegment,
    whatsappEnabled?: boolean,
  ): Promise<AuthTokens> {
    // name and email are included for UI display only.
    // Backend guards must never rely on these JWT claims as authoritative —
    // always re-fetch from the database for any security-sensitive operation.
    const payload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
      tenant_status: tenantStatus,
      tenant_segment: tenantSegment ?? TenantSegment.WORKSHOP,
      whatsapp_enabled: whatsappEnabled ?? false,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    return { access_token: accessToken, refresh_token: refreshToken };
  }
}
