import { MailModule } from '@/lib/mail/mail.module';
import { Module } from '@nestjs/common';
import { SubscriptionPlaneController } from './controller/subscription-plane.controller';
import { SubscriptionController } from '../stripe-payment/controller/subscription.controller';
import { SubscriptionPlaneService } from './service/subscription-plane.service';
import { SubscriptionSchedulerService } from './service/subscription-scheduler.service';
import { SubscriptionService } from '../stripe-payment/service/subscription.service';

@Module({
  imports: [MailModule],
  controllers: [SubscriptionPlaneController, SubscriptionController],
  providers: [
    SubscriptionPlaneService,
    SubscriptionSchedulerService,
    SubscriptionService,
  ],
  exports: [SubscriptionService, SubscriptionSchedulerService],
})
export class SubscriptionPlaneModule {}
