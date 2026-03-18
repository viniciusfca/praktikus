import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Post, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/roles.guard';
import { Roles } from '../../core/auth/roles.decorator';
import { UserRole } from '../../core/auth/user.entity';
import { AuthUser } from '../../core/auth/jwt.strategy';
import { AppointmentCommentsService } from './appointment-comments.service';
import { CreateAppointmentCommentDto } from './dto/create-appointment-comment.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller('workshop/appointments/:appointmentId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentCommentsController {
  constructor(private readonly commentsService: AppointmentCommentsService) {}

  @Get()
  list(
    @Request() req: RequestWithUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.commentsService.listComments(req.user.tenantId, appointmentId);
  }

  @Post()
  addComment(
    @Request() req: RequestWithUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: CreateAppointmentCommentDto,
  ) {
    return this.commentsService.addComment(
      req.user.tenantId,
      appointmentId,
      dto,
      req.user.userId,
    );
  }

  @Delete(':commentId')
  @Roles(UserRole.OWNER)
  @HttpCode(204)
  deleteComment(
    @Request() req: RequestWithUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentsService.deleteComment(req.user.tenantId, appointmentId, commentId);
  }
}
