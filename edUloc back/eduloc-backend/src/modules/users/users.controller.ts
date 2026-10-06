import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.service.me(u.userId);
  }

  @Patch('me')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    return this.service.updateMe(u.userId, dto);
  }

  @Delete('me')
  remove(@CurrentUser() u: AuthUser) {
    return this.service.softDelete(u.userId);
  }
}
