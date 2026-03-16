import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity, UserRole } from './user.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { TenancyService } from '../tenancy/tenancy.service';
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
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existingTenant = await this.tenancyService.findByCnpj(dto.cnpj);
    if (existingTenant) {
      throw new ConflictException('CNPJ já cadastrado.');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const tenant = await this.tenancyService.createTenant({
      cnpj: dto.cnpj,
      razaoSocial: dto.razaoSocial,
      nomeFantasia: dto.nomeFantasia,
      telefone: dto.telefone,
      endereco: dto.endereco,
    });

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      tenantId: tenant.id,
      email: dto.email,
      passwordHash,
      name: dto.ownerName,
      role: UserRole.OWNER,
    });
    const savedUser = await this.userRepo.save(user);

    await this.billingService.setupTrial(tenant.id, dto.email, dto.nomeFantasia);

    return this.generateTokens(savedUser);
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

    return this.generateTokens(user);
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

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    await this.refreshTokenRepo.update({ tokenHash }, { revoked: true });
  }

  private async generateTokens(user: UserEntity): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
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
