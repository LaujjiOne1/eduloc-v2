import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/rate-limit.service';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from './messages.controller';
import { CallsController } from './calls.controller';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { CallsService } from './calls.service';

@Module({
  controllers: [ConversationsController, MessagesController, CallsController],
  providers: [ConversationsService, MessagesService, CallsService, RateLimitService],
  exports: [ConversationsService, MessagesService],
})
export class CommunicationModule {}
