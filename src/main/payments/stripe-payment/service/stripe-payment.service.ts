import { ENVEnum } from '@/common/enum/env.enum';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Stripe } from 'stripe';
import { SubscriptionService } from './subscription.service';

export interface CreatePaymentIntentDto {
  userId: string;
  planId: string;
  durationMonths?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  successUrl?: string;
  cancelUrl?: string;
}

@Injectable()
export class StripePaymentService {
  private readonly logger = new Logger(StripePaymentService.name);
  private readonly stripePrivateKey: string;
  private readonly webhookSecret: string;
  private readonly stripe: Stripe;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.stripePrivateKey = this.config.getOrThrow(ENVEnum.STRIPE_SECRET_KEY);
    this.webhookSecret = this.config.get(ENVEnum.STRIPE_WEBHOOK_SECRET) || '';
    this.baseUrl = this.config.getOrThrow(ENVEnum.BASE_URL);
    this.stripe = new Stripe(this.stripePrivateKey, {});
  }

  /**
   * Create Stripe checkout session for subscription
   * Returns URL for hosted payment page
   */

  @HandleError('Error creating Stripe checkout session')
  async createStripePaymentIntent(
    createDto: CreatePaymentIntentDto,
    userId: string,
  ) {
    const { planId, durationMonths = 1, successUrl, cancelUrl } = createDto;

    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const plan = await this.prisma.client.plan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new NotFoundException('Plan not found');
      }

      const basePrice = parseFloat(plan.price) || 0;
      const amount = Math.round(basePrice * durationMonths * 100);

      const defaultSuccessUrl = 'https://childcareregister.com/payment/success';
      const defaultCancelUrl = 'https://childcareregister.com/payment/cancel';

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${plan.name} Plan`,
                description: `${durationMonths} month(s) subscription`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: defaultSuccessUrl,
        cancel_url: defaultCancelUrl,
        customer_email: user.email,
        metadata: {
          userId,
          planId,
          durationMonths: durationMonths.toString(),
          userEmail: user.email,
          planName: plan.name,
        },
      });

      this.logger.log(
        `Checkout session created: ${session.id} for user ${userId}`,
      );

      return {
        url: session.url,
        sessionId: session.id,
        amount,
        currency: 'usd',
      };
    } catch (error) {
      this.logger.error(
        `Error creating checkout session: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Verify payment status
   */

  @HandleError('Error verifying payment')
  async verifyPayment(paymentIntentId: string) {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */

  @HandleError('Error handling successful payment')
  async handleSuccessfulPayment(paymentIntentId: string) {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        this.logger.log(
          `Payment succeeded: ${paymentIntentId}. Metadata: ${JSON.stringify(paymentIntent.metadata)}`,
        );

        const { userId, planId, durationMonths } = paymentIntent.metadata;

        // Create subscription automatically
        const subscription = await this.subscriptionService.createSubscription({
          userId,
          planId,
          durationMonths: parseInt(durationMonths || '1'),
        });

        this.logger.log(
          `Subscription created: ${subscription.id} for user ${userId}`,
        );

        return {
          success: true,
          subscription,
          message: 'Payment successful and subscription activated',
        };
      }

      return {
        success: false,
        message: 'Payment not completed',
      };
    } catch (error: any) {
      this.logger.error(`Error handling successful payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle completed checkout session
   * Called when user completes payment via Stripe Checkout
   */
  @HandleError('Error handling completed checkout session')
  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    try {
      this.logger.log(
        `Checkout session completed: ${session.id}. Metadata: ${JSON.stringify(session.metadata)}`,
      );

      if (session.payment_status === 'paid') {
        const { userId, planId, durationMonths } = session.metadata || {};

        if (!userId || !planId) {
          this.logger.error('Missing metadata in checkout session');
          return { success: false, message: 'Missing required metadata' };
        }

        // Create subscription automatically
        const subscription = await this.subscriptionService.createSubscription({
          userId,
          planId,
          durationMonths: parseInt(durationMonths || '1'),
        });

        this.logger.log(
          `Subscription created from checkout: ${subscription.id} for user ${userId}`,
        );

        return {
          success: true,
          subscription,
          message: 'Payment successful and subscription activated',
        };
      }

      return {
        success: false,
        message: 'Payment not completed',
      };
    } catch (error: any) {
      this.logger.error(`Error handling checkout session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get payment methods for customer
   */

  @HandleError('Error fetching payment methods')
  async getPaymentMethods(customerId: string) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error: any) {
      this.logger.error(`Error fetching payment methods: ${error.message}`);
      throw error;
    }
  }
}
