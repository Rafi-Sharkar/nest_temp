import { HandleError } from '@/core/error/handle-error.decorator';
import { MailService } from '@/lib/mail/mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma';
import { isActiveSubscriptionStatus } from '../../subscription-plane/subscription.constants';

export interface CreateSubscriptionDto {
  userId: string;
  planId: string;
  durationMonths?: number;
}

export interface UpdateSubscriptionDto {
  planId?: string;
  status?: SubscriptionStatus;
  endDate?: Date;
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Create a new subscription for a user
   */
  @HandleError('Error creating subscription')
  async createSubscription(createDto: CreateSubscriptionDto) {
    const { userId, planId, durationMonths = 1 } = createDto;

    // Check if user exists
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if plan exists
    const plan = await this.prisma.client.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Check if user already has an active subscription
    const existingSubscription =
      await this.prisma.client.subscription.findUnique({
        where: { userId },
      });

    if (
      existingSubscription &&
      isActiveSubscriptionStatus(existingSubscription.status) &&
      (!existingSubscription.endDate ||
        existingSubscription.endDate > new Date())
    ) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Calculate end date based on duration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    // Create or update subscription
    const subscription = existingSubscription
      ? await this.prisma.client.subscription.update({
          where: { userId },
          data: {
            planId,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
          },
          include: {
            plan: {
              include: {
                features: {
                  include: {
                    feature: true,
                  },
                },
              },
            },
            user: true,
          },
        })
      : await this.prisma.client.subscription.create({
          data: {
            userId,
            planId,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
          },
          include: {
            plan: {
              include: {
                features: {
                  include: {
                    feature: true,
                  },
                },
              },
            },
            user: true,
          },
        });

    // Send subscription confirmation email
    await this.sendSubscriptionConfirmationEmail(
      user.email,
      user.name || 'User',
      plan.name,
      startDate,
      endDate,
    );

    return subscription;
  }

  /**
   * Get user's subscription
   */
  @HandleError('Error fetching subscription')
  async getUserSubscription(userId: string) {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { userId },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * Update subscription
   */
  @HandleError('Error updating subscription')
  async updateSubscription(userId: string, updateDto: UpdateSubscriptionDto) {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // If changing plan, verify new plan exists
    if (updateDto.planId) {
      const plan = await this.prisma.client.plan.findUnique({
        where: { id: updateDto.planId },
      });

      if (!plan) {
        throw new NotFoundException('Plan not found');
      }
    }

    return this.prisma.client.subscription.update({
      where: { userId },
      data: updateDto,
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   *----------- Cancel subscription --------------------------
   */
  @HandleError('Error cancelling subscription')
  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { userId },
      include: {
        user: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Update subscription status to CANCELLED
    const updatedSubscription = await this.prisma.client.subscription.update({
      where: { userId },
      data: { status: SubscriptionStatus.CANCELLED },
      include: {
        plan: true,
      },
    });

    // Send cancellation email
    await this.sendSubscriptionCancellationEmail(
      subscription.user.email,
      subscription.user.name || 'User',
      subscription.plan.name,
      subscription.endDate || new Date(),
    );

    return updatedSubscription;
  }

  /**
   *------------ Renew subscription (extend end date) -------------
   */
  @HandleError('Error renewing subscription')
  async renewSubscription(userId: string, durationMonths: number = 1) {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { userId },
      include: {
        user: true,
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // ----------------- Calculate new renewal window ----------------
    const now = new Date();
    const renewalBaseDate =
      subscription.endDate && subscription.endDate > now
        ? subscription.endDate
        : now;
    const newStartDate =
      subscription.endDate && subscription.endDate > now
        ? subscription.startDate
        : now;
    const newEndDate = new Date(renewalBaseDate);
    newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

    //--------------------- Update subscription ----------------------
    const updatedSubscription = await this.prisma.client.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startDate: newStartDate,
        endDate: newEndDate,
      },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
    });

    // -------------- Send renewal confirmation email ----------------`
    await this.sendSubscriptionRenewalEmail(
      subscription.user.email,
      subscription.user.name || 'User',
      subscription.plan.name,
      newEndDate,
    );

    return updatedSubscription;
  }

  /**
  --------------- Check if user has active subscription ---------------
   */
  @HandleError('Error checking subscription status')
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { userId },
    });

    return (
      !!subscription &&
      isActiveSubscriptionStatus(subscription.status) &&
      (!subscription.endDate || subscription.endDate > new Date())
    );
  }

  /**
   * ---------------- Get all subscriptions (admin) ----------------
   */
  @HandleError('Error fetching all subscriptions')
  async getAllSubscriptions(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.prisma.client.subscription.findMany({
        skip,
        take: limit,
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      }),
      this.prisma.client.subscription.count(),
    ]);

    return {
      data: subscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== EMAIL NOTIFICATIONS ====================

  private async sendSubscriptionConfirmationEmail(
    email: string,
    userName: string,
    planName: string,
    startDate: Date,
    endDate: Date,
  ) {
    const subject = 'Subscription Activated Successfully';
    const html = this.subscriptionConfirmationTemplate(
      userName,
      planName,
      startDate.toLocaleDateString(),
      endDate.toLocaleDateString(),
    );

    await this.mailService.sendMail({
      to: email,
      subject,
      html,
      text: `Hi ${userName}, Your ${planName} subscription has been activated from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.`,
    });
  }

  private async sendSubscriptionCancellationEmail(
    email: string,
    userName: string,
    planName: string,
    endDate: Date,
  ) {
    const subject = '❌ Subscription Cancelled';
    const html = this.subscriptionCancellationTemplate(
      userName,
      planName,
      endDate.toLocaleDateString(),
    );

    await this.mailService.sendMail({
      to: email,
      subject,
      html,
      text: `Hi ${userName}, Your ${planName} subscription has been cancelled. Access will continue until ${endDate.toLocaleDateString()}.`,
    });
  }

  private async sendSubscriptionRenewalEmail(
    email: string,
    userName: string,
    planName: string,
    newEndDate: Date,
  ) {
    const subject = 'Subscription Renewed Successfully';
    const html = this.subscriptionRenewalTemplate(
      userName,
      planName,
      newEndDate.toLocaleDateString(),
    );

    await this.mailService.sendMail({
      to: email,
      subject,
      html,
      text: `Hi ${userName}, Your ${planName} subscription has been renewed. New expiry date: ${newEndDate.toLocaleDateString()}.`,
    });
  }

  // ==================== EMAIL TEMPLATES ====================

  private subscriptionConfirmationTemplate(
    userName: string,
    planName: string,
    startDate: string,
    endDate: string,
  ): string {
    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif; background-color:#0f1220; padding:36px 16px;">
        <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden;">
          <div style="background-color:#10B981; padding:30px; text-align:center;">
            <h1 style="color:#fff; margin:0;">✅ Subscription Activated</h1>
          </div>
          <div style="padding:30px;">
            <p style="font-size:16px; color:#333;">Hi <strong>${userName}</strong>,</p>
            <p style="font-size:15px; color:#666; line-height:1.7;">
              Great news! Your <strong>${planName}</strong> subscription has been successfully activated.
            </p>
            <div style="background:#F3F4F6; padding:20px; border-radius:8px; margin:20px 0;">
              <p style="margin:5px 0; color:#333;"><strong>Plan:</strong> ${planName}</p>
              <p style="margin:5px 0; color:#333;"><strong>Start Date:</strong> ${startDate}</p>
              <p style="margin:5px 0; color:#333;"><strong>End Date:</strong> ${endDate}</p>
            </div>
            <p style="font-size:14px; color:#666;">Thank you for subscribing!</p>
          </div>
        </div>
      </div>
    `;
  }

  private subscriptionCancellationTemplate(
    userName: string,
    planName: string,
    endDate: string,
  ): string {
    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif; background-color:#0f1220; padding:36px 16px;">
        <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden;">
          <div style="background-color:#EF4444; padding:30px; text-align:center;">
            <h1 style="color:#fff; margin:0;">Subscription Cancelled</h1>
          </div>
          <div style="padding:30px;">
            <p style="font-size:16px; color:#333;">Hi <strong>${userName}</strong>,</p>
            <p style="font-size:15px; color:#666; line-height:1.7;">
              Your <strong>${planName}</strong> subscription has been cancelled. You will continue to have access until <strong>${endDate}</strong>.
            </p>
            <p style="font-size:14px; color:#666;">We're sorry to see you go. You can reactivate anytime!</p>
          </div>
        </div>
      </div>
    `;
  }

  private subscriptionRenewalTemplate(
    userName: string,
    planName: string,
    newEndDate: string,
  ): string {
    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif; background-color:#0f1220; padding:36px 16px;">
        <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden;">
          <div style="background-color:#E8B923; padding:30px; text-align:center;">
            <h1 style="color:#0A0E27; margin:0;">🎉 Subscription Renewed</h1>
          </div>
          <div style="padding:30px;">
            <p style="font-size:16px; color:#333;">Hi <strong>${userName}</strong>,</p>
            <p style="font-size:15px; color:#666; line-height:1.7;">
              Your <strong>${planName}</strong> subscription has been successfully renewed!
            </p>
            <div style="background:#F3F4F6; padding:20px; border-radius:8px; margin:20px 0;">
              <p style="margin:5px 0; color:#333;"><strong>New Expiry Date:</strong> ${newEndDate}</p>
            </div>
            <p style="font-size:14px; color:#666;">Thank you for continuing with us!</p>
          </div>
        </div>
      </div>
    `;
  }
}
