import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { AuthUser } from '../../core/auth/jwt.strategy';
import {
  EmployeePermissionsGuard,
  RequirePermission,
} from '../employees/employee-permissions.guard';
import { ColetaCommentsService } from './coleta-comments.service';
import { CreateColetaCommentDto } from './dto/create-coleta-comment.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('recycling/coletas/:coletaId/comments')
@UseGuards(JwtAuthGuard, EmployeePermissionsGuard)
@RequirePermission('canManageColetas')
export class ColetaCommentsController {
  constructor(private readonly commentsService: ColetaCommentsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Param('coletaId', ParseUUIDPipe) coletaId: string,
  ) {
    return this.commentsService.listComments(req.user.tenantId, coletaId);
  }

  @Post()
  add(
    @Request() req: RequestWithUser,
    @Param('coletaId', ParseUUIDPipe) coletaId: string,
    @Body() dto: CreateColetaCommentDto,
  ) {
    return this.commentsService.addComment(
      req.user.tenantId,
      coletaId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':commentId')
  @HttpCode(204)
  delete(
    @Request() req: RequestWithUser,
    @Param('coletaId', ParseUUIDPipe) coletaId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentsService.deleteComment(
      req.user.tenantId,
      coletaId,
      commentId,
      {
        userId: req.user.userId,
        role: req.user.role,
      },
    );
  }
}
