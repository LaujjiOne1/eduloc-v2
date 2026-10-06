import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import {
  ModerateOfferDto, RejectApplicationDto, ResolveConflictDto,
  SetUserStatusDto, SuspendTutorDto, UsersQueryDto,
} from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('users')
  users(@Query() q: UsersQueryDto) {
    return this.service.users(q);
  }

  @Post('users/:id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserStatusDto) {
    return this.service.setUserStatus(id, dto.status);
  }

  @Get('tutor-applications')
  applications(@Query('status') status?: string) {
    return this.service.tutorApplications(status);
  }

  @Post('tutor-applications/:id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.approveApplication(u.userId, id);
  }

  @Post('tutor-applications/:id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectApplicationDto) {
    return this.service.rejectApplication(u.userId, id, dto.reason);
  }

  @Post('tutors/:id/suspend')
  suspend(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SuspendTutorDto) {
    return this.service.suspendTutor(u.userId, id, dto.reason);
  }

  @Post('offers/:id/moderation')
  moderate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateOfferDto) {
    return this.service.moderateOffer(id, dto.action);
  }

  @Get('bookings')
  bookings(@Query('status') status?: string, @Query('page') page = '1') {
    return this.service.bookings(status, parseInt(page, 10) || 1);
  }

  @Get('conflicts')
  conflicts(@Query('status') status?: string) {
    return this.service.conflicts(status);
  }

  @Post('conflicts/:id/resolve')
  resolve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveConflictDto) {
    return this.service.resolveConflict(u.userId, id, dto.resolution);
  }

  @Post('conflicts/:id/dismiss')
  dismiss(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.dismissConflict(u.userId, id);
  }
}
