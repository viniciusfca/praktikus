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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
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

@Controller('workshop/company')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

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
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = join(process.cwd(), 'uploads', 'logos');
          cb(null, dest);
        },
        filename: (_req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(new BadRequestException('Apenas JPG e PNG são permitidos.'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadLogo(@Request() req: RequestWithUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo de logo não fornecido.');
    }
    const logoUrl = `/uploads/logos/${file.filename}`;
    return this.companiesService.updateLogo(req.user.tenantId, logoUrl);
  }
}
