import { Module } from '@nestjs/common';
import {
  AvailabilitiesController, OffersController, PlacesController, TutorsController,
} from './tutors.controller';
import {
  AvailabilitiesService, OffersService, PlacesService, TutorsService,
} from './tutors.service';

@Module({
  controllers: [TutorsController, OffersController, PlacesController, AvailabilitiesController],
  providers: [TutorsService, OffersService, PlacesService, AvailabilitiesService],
})
export class TutorsModule {}
