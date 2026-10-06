import { Body, Controller, Headers, Param, ParseUUIDPipe, Post, Req, RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto';

@ApiTags('calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly service: CallsService) {}

  @Post()
  @ApiBearerAuth()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCallDto) {
    return this.service.createCall(user.userId, dto);
  }

  @Post(':id/token')
  @ApiBearerAuth()
  token(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.callToken(user.userId, id);
  }

  @Post('webhook/livekit')
  @Public()
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') auth: string,
  ) {
    return this.service.handleWebhook(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})), auth ?? '');
  }
}
