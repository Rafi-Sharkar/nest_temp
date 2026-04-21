import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@/lib/prisma/prisma.service'; // Assuming you use Prisma for DB handling
import { SubscriptionService } from './subscription.service'; // Assuming SubscriptionService handles subscription logic
import { HandleError } from '../../../../core/error/handle-error.decorator';

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly secretKey = 'sk_lIuDfxnJCOevwtYcZYFDEYEfMLENp';

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // Signature validation function
  validateSignature(signature: string, payload: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }

  // Handle the event from RevenueCat webhook
  async handleEvent(payload: string, signature: string): Promise<void> {
    if (!this.validateSignature(signature, payload)) {
      this.logger.error('Invalid signature!');
      throw new Error('Invalid signature');
    }

    const event = JSON.parse(payload);

    // Event type handling
    switch (event.type) {
      case 'INITIAL_PURCHASE':
        this.logger.log('Handling initial purchase event...');
        await this.handleInitialPurchase(event);
        break;
      case 'CANCELLATION':
        this.logger.log('Handling cancellation event...');
        await this.handleCancellation(event);
        break;
      case 'RENEWAL':
        this.logger.log('Handling renewal event...');
        await this.handleRenewal(event);
        break;
      default:
        this.logger.log('Unknown event type: ', event.type);
    }
  }

  // Handle Initial Purchase
  private async handleInitialPurchase(event: any) {
    // Example logic for creating a subscription on initial purchase
    const { user_id, plan_id } = event.data;
    await this.subscriptionService.createSubscription({
      userId: user_id,
      planId: plan_id,
    });
  }

  // Handle Cancellation
  private async handleCancellation(event: any) {
    const { user_id } = event.data;
    await this.subscriptionService.cancelSubscription(user_id);
  }

  // Handle Renewal
  private async handleRenewal(event: any) {
    const { user_id, plan_id } = event.data;
    await this.subscriptionService.renewSubscription(user_id);
  }

  // Create payment for RevenueCat subscription
  @HandleError('Error creating payment')
  async createPayment(userId: string, dto: any): Promise<any> {
    try {
      this.logger.log(`Creating RevenueCat payment for user: ${userId}`);

      // Get user from database
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get plan details
      const plan = await this.prisma.client.plan.findUnique({
        where: { id: dto.planId },
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Create subscription
      const subscription = await this.subscriptionService.createSubscription({
        userId: userId,
        planId: dto.planId,
      });

      this.logger.log(`Payment created successfully for user: ${userId}`);
      return {
        success: true,
        data: subscription,
        message: 'Payment initiated successfully',
      };
    } catch (error: any) {
      this.logger.error(`Error creating payment: ${error.message}`);
      throw error;
    }
  }
}
