import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { fromBuffer } from 'file-type';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuthUser } from '../../core/auth/jwt.strategy';

interface RequestWithUser extends Request {
  user: AuthUser;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const LOGOS_DIR = join(process.cwd(), 'uploads', 'logos');

@Controller('workshop/company')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController implements OnModuleInit {
  constructor(private readonly companiesService: CompaniesService) {}

  onModuleInit(): void {
    mkdirSync(LOGOS_DIR, { recursive: true });
  }

  @Get()
  getProfile(@Request() req: RequestWithUser) {
    return this.companiesService.getProfile(req.user.tenantId);
  }

  @Patch()
  @Roles(UserRole.OWNER)
  updateProfile(@Request() req: RequestWithUser, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateProfile(req.user.tenantId, dto);
  }

  @Post('logo')
  @Roles(UserRole.OWNER)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadLogo(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo de logo não fornecido.');
    }

    // Magic-byte inspection — ignore client-supplied Content-Type
    const type = await fromBuffer(file.buffer);
    if (!type || !ALLOWED_MIME_TYPES.has(type.mime)) {
      throw new BadRequestException('Apenas imagens JPG e PNG são permitidas.');
    }

    // Whitelist extension based on actual file type, not client input
    const ext = EXTENSION_MAP[type.mime];
    const filename = `${Date.now()}${ext}`;
    const dest = join(LOGOS_DIR, filename);

    writeFileSync(dest, file.buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    return this.companiesService.updateLogo(req.user.tenantId, logoUrl);
  }
}
