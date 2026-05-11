import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/login.dto';
import { PlatformRefreshDto } from './dto/refresh.dto';
import { PlatformLogoutDto } from './dto/logout.dto';
import { PlatformAuthGuard } from './platform-auth.guard';

@Controller('admin/auth')
export class PlatformAuthController {
  private readonly logger = new Logger(PlatformAuthController.name);

  constructor(private readonly auth: PlatformAuthService) {}

  // 10 tentativas / 15 min por IP — anti força bruta
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: PlatformLoginDto) {
    try {
      const tokens = await this.auth.login(dto);
      this.logger.log({
        event: 'platform_login_success',
        email: dto.email,
        userId: tokens.user.id,
      });
      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        this.logger.warn({
          event: 'platform_login_failure',
          email: dto.email,
        });
      }
      throw err;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: PlatformRefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @UseGuards(PlatformAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: PlatformLogoutDto): Promise<void> {
    this.logger.log({ event: 'platform_logout' });
    await this.auth.logout(dto.refresh_token);
  }
}
