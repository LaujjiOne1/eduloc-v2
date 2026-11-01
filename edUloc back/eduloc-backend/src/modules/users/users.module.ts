import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserAvatarService } from './user-avatar.service';
import { UsersService } from './users.service';

@Module({ controllers: [UsersController], providers: [UsersService, UserAvatarService] })
export class UsersModule {}
