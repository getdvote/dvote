import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminFeedbackController, FeedbackController, VendorFeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/** Customer (/api/app/feedback, Google Sheet) and merchant (/api/vendor/feedback, stored + sheet copy) feedback; admins read merchant feedback at /api/admin/merchant-feedback. */
@Module({
  imports: [AuthModule],
  controllers: [FeedbackController, VendorFeedbackController, AdminFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
