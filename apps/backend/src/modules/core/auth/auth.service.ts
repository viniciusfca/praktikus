import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity, UserRole } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
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
    private readonly tenancyService: TenancyService,
    private readonly billingService: BillingService,
    private readonly jwtService: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    // Check uniqueness BEFORE starting transaction (avoids holding locks during slug generation)
    const existingTenant = await this.tenancyService.findByCnpj(dto.cnpj);
    if (existingTenant) {
      throw new ConflictException('CNPJ já cadastrado.');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    // Transactional: create tenant + user atomically
    const { tenant, user } = await this.dataSource.transaction(async (manager) => {
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
    });

    // Billing is OUTSIDE the transaction (external API, cannot roll back Asaas)
    // If this fails, tenant + user exist but without billing. The user can still log in
    // and billing can be retried via a separate flow.
    await this.billingService.setupTrial(tenant.id, dto.email, dto.nomeFantasia);

    return this.generateTokens(user, tenant.status, tenant.segment);
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

    const tenant = await this.tenancyService.findById(user.tenantId);
    return this.generateTokens(user, tenant?.status ?? TenantStatus.ACTIVE, tenant?.segment);
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

    const tenant = await this.tenancyService.findById(user.tenantId);
    return this.generateTokens(user, tenant?.status ?? TenantStatus.ACTIVE, tenant?.segment);
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

  private async generateTokens(user: UserEntity, tenantStatus: string, tenantSegment?: TenantSegment): Promise<AuthTokens> {
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
