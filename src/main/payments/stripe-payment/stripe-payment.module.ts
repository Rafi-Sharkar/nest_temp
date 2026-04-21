import { Module } from '@nestjs/common';
import { SubscriptionPlaneModule } from '../subscription-plane/subscription-plane.module';
import { StripePaymentController } from './controller/stripe-payment.controller';
import { WebhookController } from './controller/webhook.controller';
import { StripePaymentService } from './service/stripe-payment.service';

@Module({
  imports: [SubscriptionPlaneModule],
  controllers: [StripePaymentController, WebhookController],
  providers: [StripePaymentService],
  exports: [StripePaymentService],
})
export class StripePaymentModule {}
