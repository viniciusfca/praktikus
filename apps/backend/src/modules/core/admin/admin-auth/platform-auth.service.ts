import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PlatformUserEntity } from './platform-user.entity';
import { PlatformRefreshTokenEntity } from './platform-refresh-token.entity';
import { PlatformLoginDto } from './dto/login.dto';

export interface PlatformAuthTokens {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; name: string };
}

const BCRYPT_COST = 12;

@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformUserEntity)
    private readonly userRepo: Repository<PlatformUserEntity>,
    @InjectRepository(PlatformRefreshTokenEntity)
    private readonly refreshRepo: Repository<PlatformRefreshTokenEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: PlatformLoginDto): Promise<PlatformAuthTokens> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<PlatformAuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshRepo.findOne({ where: { tokenHash } });
    if (!stored || stored.revoked) {
      throw new UnauthorizedException('Refresh inválido.');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh expirado.');
    }
    stored.revoked = true;
    await this.refreshRepo.save(stored);

    const user = await this.userRepo.findOne({
      where: { id: stored.platformUserId },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshRepo.update({ tokenHash }, { revoked: true });
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    user: PlatformUserEntity,
  ): Promise<PlatformAuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      is_platform_user: true as const,
    };
    const expiresIn =
      this.config.get<string>('PLATFORM_JWT_EXPIRES_IN') ?? '8h';
    const signOptions: JwtSignOptions = { expiresIn: expiresIn as JwtSignOptions['expiresIn'] };
    const accessToken = this.jwt.sign(payload, signOptions);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        platformUserId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
