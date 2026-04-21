import { Module } from '@nestjs/common';

import { StripePaymentModule } from './stripe-payment/stripe-payment.module';
import { SubscriptionPlaneModule } from './subscription-plane/subscription-plane.module';

@Module({
  controllers: [],
  providers: [],
  imports: [StripePaymentModule, SubscriptionPlaneModule],
})
export class PaymentsModule {}
