import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FeedbackController, VendorFeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/** Customer (/api/app/feedback) and merchant (/api/vendor/feedback) feedback, written to a Google Sheet. */
@Module({
  imports: [AuthModule],
  controllers: [FeedbackController, VendorFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
