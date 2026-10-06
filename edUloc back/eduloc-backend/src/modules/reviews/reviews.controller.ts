import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateReviewDto) {
    return this.service.create(u.userId, dto);
  }

  @Public()
  @Get('tutors/:id')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.tutorReviews(id);
  }
}
