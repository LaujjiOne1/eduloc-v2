import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RegisterDeviceDto } from './dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() u: AuthUser, @Query('unread') unread?: string) {
    return this.service.list(u.userId, unread === 'true');
  }

  @Post('notifications/read')
  markAll(@CurrentUser() u: AuthUser) {
    return this.service.markRead(u.userId);
  }

  @Post('notifications/:id/read')
  markOne(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(u.userId, id);
  }

  @Post('devices')
  register(@CurrentUser() u: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.service.registerDevice(u.userId, dto.token, dto.platform);
  }
}
