import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/rate-limit.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { LessonRemindersService } from './lesson-reminders.service';
import { BookingsRepository } from './bookings.repository';
import { RoomReservationService } from './room-reservation.service';
import { BookingHoldsService } from './booking-holds.service';
import { BookingExpiryQueue } from './booking-expiry.queue';
import { BookingExpiryWorker } from './booking-expiry.worker';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsService, BookingsRepository, RoomReservationService, BookingHoldsService, RateLimitService, LessonRemindersService,
    BookingExpiryQueue, BookingExpiryWorker,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
