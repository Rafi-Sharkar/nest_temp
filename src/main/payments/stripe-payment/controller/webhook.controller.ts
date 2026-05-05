import { ENVEnum } from '@/common/enum/env.enum';
import { UserEnum } from '@/common/enum/user.enum';
import { HandleError } from '@/core/error/handle-error.decorator';
import { MailService } from '@/lib/mail/mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import {
  Controller,
  Headers,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma';
import { Request, Response } from 'express';
import Stripe from 'stripe';

// Local event type definitions
const EVENT_TYPES = {
  PAYMENT_CREATE: 'payment.create',
};

type payment = any; // Event payload type - flexible for various payment events

@ApiTags('Webhook--------------stipe events')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const stripeKey = this.config.getOrThrow(ENVEnum.STRIPE_SECRET_KEY);
    this.webhookSecret = this.config.get(ENVEnum.STRIPE_WEBHOOK_SECRET) || '';
    this.stripe = new Stripe(stripeKey, {});
  }

  @ApiOperation({ summary: 'Stripe webhook endpoint for payment events' })
  @Post('stripe')
  @HandleError('Error handling Stripe webhook')
  async handleStripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('=== WEBHOOK RECEIVED ===');
    this.logger.log(`Signature header: ${signature ? 'Present' : 'Missing'}`);
    this.logger.log(`Raw body type: ${typeof req.rawBody}`);
    this.logger.log(
      `Raw body length: ${req.rawBody ? req.rawBody.length : 'undefined'}`,
    );

    if (!signature) {
      this.logger.error('Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      // Use rawBody for signature verification (must be Buffer)
      const rawBody = req.rawBody;

      if (!rawBody) {
        this.logger.error('Raw body not available for signature verification');
        this.logger.debug(`Request body type: ${typeof req.body}`);
        this.logger.debug(
          `Request body keys: ${req.body ? Object.keys(req.body) : 'N/A'}`,
        );
        return res.status(400).json({ error: 'Invalid request body' });
      }

      //---------- Verify webhook signature -----------------
      if (this.webhookSecret) {
        this.logger.log('Verifying webhook signature...');
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          this.webhookSecret,
        );
        this.logger.log('Webhook signature verified successfully');
      } else {
        this.logger.warn(
          'Webhook secret not configured, skipping verification (NOT RECOMMENDED FOR PRODUCTION)',
        );
        event = JSON.parse(rawBody.toString());
      }
    } catch (err: any) {
      this.logger.error(`Invalid webhook signature: ${err.message}`);
      this.logger.error(`Error stack: ${err.stack}`);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    this.logger.log(`Webhook received: ${event.type}`);

    try {
      if (event.type === 'checkout.session.completed') {
        await this.handleCheckoutCompleted(event);
      }

      if (event.type === 'payment_intent.succeeded') {
        await this.handlePaymentSucceeded(event);
      }

      if (
        [
          'payment_intent.payment_failed',
          'checkout.session.async_payment_failed',
        ].includes(event.type)
      ) {
        await this.handlePaymentFailed(event);
      }

      return res
        .status(HttpStatus.OK)
        .json({ received: true, eventType: event.type });
    } catch (err: any) {
      this.logger.error(`Webhook handling error: ${err.message}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   *--------------  Handle checkout session completed ----------------
   */
  private async handleCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const durationMonths = parseInt(session.metadata?.durationMonths || '1');

    if (!userId || !planId) {
      this.logger.error(
        'Missing userId or planId in checkout session metadata',
      );
      return;
    }

    if (session.payment_status !== 'paid') {
      this.logger.log(`Payment not completed for session ${session.id}`);
      return;
    }

    // ------------------- Fetch plan details----------------
    const plan = await this.prisma.client.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      this.logger.error(`Plan not found: ${planId}`);
      return;
    }

    // ------------------- Calculate subscription end date -----------------
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    //-----------------  Create or update subscription -----------------
    const subscription = await this.prisma.client.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      },
      update: {
        planId,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      },
    });

    this.logger.log(
      `Subscription created/updated: ${subscription.id} for user ${userId}`,
    );

    // ------------- Send confirmation email ----------------------
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (user?.email) {
      const amount = session.amount_total
        ? (session.amount_total / 100).toFixed(2)
        : '0.00';
      const currency = (session.currency || 'usd').toUpperCase();

      await this.mailService.sendMail({
        to: user.email,
        subject: 'Payment Confirmation - Subscription Activated',
        text: `Your payment of ${amount} ${currency} was successful. Your ${plan.name} subscription is now active until ${endDate.toLocaleDateString()}.`,
        html: `
          <h2>Payment Successful!</h2>
          <p><strong>Plan:</strong> ${plan.name}</p>
          <p><strong>Amount:</strong> $${amount} ${currency}</p>
          <p><strong>Duration:</strong> ${durationMonths} month(s)</p>
          <p><strong>Start Date:</strong> ${startDate.toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${endDate.toLocaleDateString()}</p>
          <p><strong>Transaction ID:</strong> ${session.payment_intent || session.id}</p>
          <p>Thank you for your subscription!</p>
        `,
      });
    }

    // ----------- notification event----------

    const Recipient = await this.prisma.client.user.findMany({
      where: {
        role: UserEnum.ADMIN,
      },
      select: { id: true, email: true },
    });

    // --------------- Send notification event ----------------
    this.eventEmitter.emit(EVENT_TYPES.PAYMENT_CREATE, {
      action: 'CREATE',
      meta: {
        action: 'created',
        info: {
          id: subscription.id,
          name: plan.name,
          price: plan.price,
          subscriptions: [],
          feature: [],
          createdAt: new Date(),
          recipients: Recipient,
        },
        meta: {
          userId,
          name: plan.name,
          price: plan.price,
          subscriptions: [],
          features: [],
          createdAt: new Date(),
        },
      },
    } as payment);
  }

  /**
   * ------------ Handle payment intent succeeded ----------------
   */
  private async handlePaymentSucceeded(event: Stripe.Event) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const userId = paymentIntent.metadata?.userId;
    const planId = paymentIntent.metadata?.planId;

    if (!userId || !planId) {
      this.logger.warn('Missing metadata in payment intent');
      return;
    }

    this.logger.log(
      `Payment succeeded: ${paymentIntent.id} for user ${userId}`,
    );
  }

  /**
   *-------------- Handle payment failed --------------------
   */
  private async handlePaymentFailed(event: Stripe.Event) {
    const dataObject: any = event.data.object;
    const userId = dataObject.metadata?.userId;
    const planId = dataObject.metadata?.planId;

    if (!userId || !planId) {
      this.logger.warn('Missing metadata in failed payment');
      return;
    }

    this.logger.error(
      `Payment failed for user ${userId}, plan ${planId}. Reason: ${dataObject.last_payment_error?.message || 'Unknown'}`,
    );

    // -------------- Send failure notification email --------------
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (user?.email) {
      const plan = await this.prisma.client.plan.findUnique({
        where: { id: planId },
      });

      await this.mailService.sendMail({
        to: user.email,
        subject: 'Payment Failed',
        text: `Your payment for ${plan?.name || 'subscription'} failed. Reason: ${dataObject.last_payment_error?.message || 'Unknown'}`,
        html: `
          <h2>Payment Failed</h2>
          <p>Unfortunately, your payment could not be processed.</p>
          <p><strong>Plan:</strong> ${plan?.name || 'N/A'}</p>
          <p><strong>Reason:</strong> ${dataObject.last_payment_error?.message || 'Unknown'}</p>
          <p>Please try again or contact support if the issue persists.</p>
        `,
      });
    }
  }
}
