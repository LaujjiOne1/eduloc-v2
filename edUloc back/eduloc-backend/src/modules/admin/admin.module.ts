import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { CommunicationModule } from '../communication/communication.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BookingsModule, CommunicationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
