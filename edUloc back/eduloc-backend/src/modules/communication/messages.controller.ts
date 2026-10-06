import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { RequestUploadDto, SendMessageDto } from './dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller()
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post('conversations/:id/uploads')
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestUploadDto,
  ) {
    return this.service.requestUpload(user.userId, id, dto);
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(user.userId, id, dto);
  }

  @Get('attachments/:id/url')
  url(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.attachmentUrl(user.userId, id);
  }

  @Post('messages/:id/listened')
  listened(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markListened(user.userId, id);
  }
}
