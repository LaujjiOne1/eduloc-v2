import { Body, Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AvatarUploadRequestDto, RegisterAvatarDto, UpdateMeDto } from './dto';
import { UserAvatarService } from './user-avatar.service';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly avatars: UserAvatarService,
  ) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.service.me(u.userId);
  }

  @Patch('me')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    return this.service.updateMe(u.userId, dto);
  }

  // --- photo de profil (tous les types de compte)
  @Post('me/avatar/upload-url')
  avatarUpload(@CurrentUser() u: AuthUser, @Body() dto: AvatarUploadRequestDto) {
    return this.avatars.createTicket(u.userId, dto);
  }

  @Post('me/avatar')
  registerAvatar(@CurrentUser() u: AuthUser, @Body() dto: RegisterAvatarDto) {
    return this.avatars.register(u.userId, dto.uploadId);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() u: AuthUser) {
    return this.avatars.remove(u.userId);
  }

  @Delete('me')
  remove(@CurrentUser() u: AuthUser) {
    return this.service.softDelete(u.userId);
  }
}
