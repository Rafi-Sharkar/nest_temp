import { MailService } from '@/lib/mail/mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_REMINDER_DAYS,
} from '../subscription.constants';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredSubscriptions() {
    this.logger.log(
      'Running scheduled task: Check expired subscriptions-------------',
    );

    try {
      const now = new Date();

      // Find all active subscriptions that have passed their end date
      const expiredSubscriptions =
        await this.prisma.client.subscription.findMany({
          where: {
            status: {
              in: ACTIVE_SUBSCRIPTION_STATUSES,
            },
            endDate: {
              lte: now,
            },
          },
          include: {
            user: true,
            plan: true,
          },
        });

      this.logger.log(
        `Found ${expiredSubscriptions.length} expired subscriptions`,
      );

      // Update each subscription to EXPIRED status
      for (const subscription of expiredSubscriptions) {
        try {
          // Update subscription status
          await this.prisma.client.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.EXPIRED },
          });

          // Send expiration notification email
          await this.sendSubscriptionExpiredEmail(
            subscription.user.email,
            subscription.user.name || 'User',
            subscription.plan.name,
            subscription.endDate!,
          );

          this.logger.log(
            `Subscription ${subscription.id} marked as EXPIRED and email sent to ${subscription.user.email}`,
          );
        } catch (error: any) {
          this.logger.error(
            `Failed to process expired subscription ${subscription.id}: ${error.message}`,
          );
        }
      }

      this.logger.log('Expired subscriptions check completed---------------');
    } catch (error: any) {
      this.logger.error(
        `Error in handleExpiredSubscriptions: ${error.message}`,
      );
    }
  }

  /**
   * Check for subscriptions expiring soon (7 days and 1 day before expiry)
   * Runs every day at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleExpiringSubscriptions() {
    this.logger.log('Running scheduled task: Check expiring subscriptions');

    try {
      const now = new Date();
      const sevenDayRange = this.getDayRangeFromNow(
        now,
        SUBSCRIPTION_REMINDER_DAYS.SEVEN_DAYS,
      );
      const oneDayRange = this.getDayRangeFromNow(
        now,
        SUBSCRIPTION_REMINDER_DAYS.ONE_DAY,
      );

      const [sevenDayWarnings, oneDayWarnings] = await Promise.all([
        this.prisma.client.subscription.findMany({
          where: {
            status: SubscriptionStatus.ACTIVE,
            endDate: {
              gte: sevenDayRange.start,
              lte: sevenDayRange.end,
            },
          },
          include: {
            user: true,
            plan: true,
          },
        }),
        this.prisma.client.subscription.findMany({
          where: {
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRING_SOON],
            },
            endDate: {
              gte: oneDayRange.start,
              lte: oneDayRange.end,
            },
          },
          include: {
            user: true,
            plan: true,
          },
        }),
      ]);

      this.logger.log(
        `Found ${sevenDayWarnings.length} subscriptions for 7-day warning and ${oneDayWarnings.length} subscriptions for 1-day warning`,
      );

      await this.processReminderBatch(
        sevenDayWarnings,
        SubscriptionStatus.EXPIRING_SOON,
        SUBSCRIPTION_REMINDER_DAYS.SEVEN_DAYS,
      );
      await this.processReminderBatch(
        oneDayWarnings,
        SubscriptionStatus.EXPIRING_TOMORROW,
        SUBSCRIPTION_REMINDER_DAYS.ONE_DAY,
      );

      this.logger.log('Expiring subscriptions check completed');
    } catch (error: any) {
      this.logger.error(
        `Error in handleExpiringSubscriptions: ${error.message}`,
      );
    }
  }

  /**
   * Send email notification when subscription has expired
   */
  private async sendSubscriptionExpiredEmail(
    email: string,
    userName: string,
    planName: string,
    expiredDate: Date,
  ) {
    const subject = '⚠️ Your Subscription Has Expired';
    const html = subscriptionExpiredTemplate({
      userName,
      planName,
      expiredDate: expiredDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      logoUrl: this.mailService.getLogoUrl(),
    });

    await this.mailService.sendMail({
      to: email,
      subject,
      html,
      text: `Hi ${userName}, Your ${planName} subscription has expired as of ${expiredDate.toLocaleDateString()}. Please renew to continue enjoying our services.`,
    });
  }

  /**
   * Send email notification when subscription is expiring soon
   */
  private async sendSubscriptionExpiringEmail(
    email: string,
    userName: string,
    planName: string,
    expiryDate: Date,
    daysRemaining: number,
  ) {
    const subject =
      daysRemaining === 1
        ? '⏰ Your Subscription Expires Tomorrow'
        : '⏰ Your Subscription is Expiring Soon';
    const html = subscriptionExpiringTemplate({
      userName,
      planName,
      expiryDate: expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      daysRemaining,
      logoUrl: this.mailService.getLogoUrl(),
    });

    await this.mailService.sendMail({
      to: email,
      subject,
      html,
      text: `Hi ${userName}, Your ${planName} subscription will expire in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} on ${expiryDate.toLocaleDateString()}. Please renew to avoid service interruption.`,
    });
  }

  /**
   * Manual check for expired subscriptions (can be called via API)
   */
  async checkAndUpdateExpiredSubscriptions() {
    return this.handleExpiredSubscriptions();
  }

  async runSubscriptionAutomation() {
    await this.handleExpiringSubscriptions();
    await this.handleExpiredSubscriptions();
  }

  private getDayRangeFromNow(baseDate: Date, daysAhead: number) {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + daysAhead);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private async processReminderBatch(
    subscriptions: Array<{
      id: string;
      endDate: Date | null;
      user: { email: string; name: string | null };
      plan: { name: string };
    }>,
    nextStatus: SubscriptionStatus,
    daysRemaining: number,
  ) {
    for (const subscription of subscriptions) {
      if (!subscription.endDate) {
        continue;
      }

      try {
        await this.prisma.client.subscription.update({
          where: { id: subscription.id },
          data: { status: nextStatus },
        });

        await this.sendSubscriptionExpiringEmail(
          subscription.user.email,
          subscription.user.name || 'User',
          subscription.plan.name,
          subscription.endDate,
          daysRemaining,
        );

        this.logger.log(
          `${daysRemaining}-day reminder sent for subscription ${subscription.id} to ${subscription.user.email}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to send ${daysRemaining}-day reminder for subscription ${subscription.id}: ${error.message}`,
        );
      }
    }
  }
}

// ─────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────

/** Top header bar with logo */
const headerBlock = (logoUrl: string) => `
  <div style="background-color:#0A0E27; padding:22px 0; border-radius:12px 12px 0 0;">
    <div style="text-align:center;">
      <img
        src="${logoUrl}"
        alt="Child Center Logo"
        style="max-height:38px; width:auto;"
      />
    </div>
  </div>
`;

/** Bottom footer bar */
const footerBlock = (footerText: string) => `
  <div style="background-color:#1A1F3A; padding:20px 28px; border-radius:0 0 12px 12px; text-align:center;">
    <p style="margin:0; font-size:13px; color:#A0A8B8; font-family:'Segoe UI',Arial,sans-serif; line-height:1.5;">
      ${footerText}
    </p>
  </div>
`;

/** Outer wrapper (background + centering) */
const wrap = (innerHtml: string) => `
<div style="font-family:'Segoe UI',Arial,sans-serif; background-color:#0f1220; min-height:100%; padding:36px 16px; margin:0; box-sizing:border-box;">
  <div style="max-width:560px; margin:0 auto; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.35);">
    ${innerHtml}
  </div>
</div>
`;

/**
 * Subscription Expired Email Template
 */
const subscriptionExpiredTemplate = ({
  userName,
  planName,
  expiredDate,
  logoUrl,
}: {
  userName: string;
  planName: string;
  expiredDate: string;
  logoUrl: string;
}) =>
  wrap(`
  ${headerBlock(logoUrl)}

  <!-- Body -->
  <div style="background-color:#ffffff; padding:36px 32px 28px;">

    <!-- Icon -->
    <div style="text-align:center; margin-bottom:20px;">
      <div style="display:inline-block; width:64px; height:64px; background-color:#FEE2E2; border-radius:50%; display:flex; align-items:center; justify-content:center;">
        <span style="font-size:32px;">⚠️</span>
      </div>
    </div>

    <!-- Title -->
    <h2 style="margin:0 0 16px; text-align:center; font-size:24px; font-weight:700; color:#0A0E27; font-family:'Segoe UI',Arial,sans-serif;">
      Your Subscription Has Expired
    </h2>

    <!-- Divider accent -->
    <div style="width:48px; height:3px; background-color:#EF4444; margin:0 auto 22px; border-radius:2px;"></div>

    <!-- Message -->
    <p style="font-size:15px; color:#6B7280; line-height:1.7; margin:0 0 20px; text-align:center; font-family:'Segoe UI',Arial,sans-serif;">
      Hi <strong style="color:#0A0E27;">${userName}</strong>,
    </p>

    <p style="font-size:15px; color:#6B7280; line-height:1.7; margin:0 0 28px; text-align:center; font-family:'Segoe UI',Arial,sans-serif;">
      Your <strong style="color:#0A0E27;">${planName}</strong> subscription expired on <strong style="color:#EF4444;">${expiredDate}</strong>.
    </p>

    <!-- Info Box -->
    <div style="background-color:#FEF3C7; border-left:4px solid #E8B923; border-radius:8px; padding:20px; margin-bottom:24px;">
      <p style="margin:0; font-size:14px; color:#78350F; line-height:1.6; font-family:'Segoe UI',Arial,sans-serif;">
        <strong>What happens now?</strong><br/>
        Your access to premium features has been suspended. Renew your subscription to continue enjoying all benefits.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center; margin:28px 0;">
      <a href="${process.env.CLIENT_URL || 'https://childcenter.com'}/subscription/renew" 
         style="display:inline-block; background-color:#E8B923; color:#0A0E27; text-decoration:none; padding:14px 36px; border-radius:8px; font-weight:700; font-size:15px; font-family:'Segoe UI',Arial,sans-serif; box-shadow:0 4px 12px rgba(232,185,35,0.3);">
        Renew Subscription
      </a>
    </div>

    <!-- Support Note -->
    <p style="font-size:13px; color:#A0A8B8; text-align:center; margin:20px 0 0; font-family:'Segoe UI',Arial,sans-serif; line-height:1.5;">
      Need help? Contact our support team at <a href="mailto:support@childcenter.com" style="color:#E8B923; text-decoration:none;">support@childcenter.com</a>
    </p>
  </div>

  ${footerBlock('© 2026 Child Center. All rights reserved.')}
`);

/**
 * Subscription Expiring Soon Email Template
 */
const subscriptionExpiringTemplate = ({
  userName,
  planName,
  expiryDate,
  daysRemaining,
  logoUrl,
}: {
  userName: string;
  planName: string;
  expiryDate: string;
  daysRemaining: number;
  logoUrl: string;
}) =>
  wrap(`
  ${headerBlock(logoUrl)}

  <!-- Body -->
  <div style="background-color:#ffffff; padding:36px 32px 28px;">

    <!-- Icon -->
    <div style="text-align:center; margin-bottom:20px;">
      <div style="display:inline-block; width:64px; height:64px; background-color:#FEF3C7; border-radius:50%; display:flex; align-items:center; justify-content:center;">
        <span style="font-size:32px;">⏰</span>
      </div>
    </div>

    <!-- Title -->
    <h2 style="margin:0 0 16px; text-align:center; font-size:24px; font-weight:700; color:#0A0E27; font-family:'Segoe UI',Arial,sans-serif;">
      Subscription Expiring Soon
    </h2>

    <!-- Divider accent -->
    <div style="width:48px; height:3px; background-color:#E8B923; margin:0 auto 22px; border-radius:2px;"></div>

    <!-- Message -->
    <p style="font-size:15px; color:#6B7280; line-height:1.7; margin:0 0 20px; text-align:center; font-family:'Segoe UI',Arial,sans-serif;">
      Hi <strong style="color:#0A0E27;">${userName}</strong>,
    </p>

    <p style="font-size:15px; color:#6B7280; line-height:1.7; margin:0 0 28px; text-align:center; font-family:'Segoe UI',Arial,sans-serif;">
      Your <strong style="color:#0A0E27;">${planName}</strong> subscription will expire in <strong style="color:#E8B923;">${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}</strong> on <strong>${expiryDate}</strong>.
    </p>

    <!-- Countdown Box -->
    <div style="background-color:#0A0E27; border-radius:10px; padding:24px 16px; text-align:center; margin-bottom:24px;">
      <p style="margin:0 0 6px; font-size:13px; color:#A0A8B8; text-transform:uppercase; letter-spacing:1.4px; font-family:'Segoe UI',Arial,sans-serif;">
        Days Remaining
      </p>
      <p style="margin:0; font-size:48px; font-weight:700; color:#E8B923; font-family:'Segoe UI',Arial,sans-serif;">
        ${daysRemaining}
      </p>
    </div>

    <!-- Info Box -->
    <div style="background-color:#DBEAFE; border-left:4px solid:#3B82F6; border-radius:8px; padding:20px; margin-bottom:24px;">
      <p style="margin:0; font-size:14px; color:#1E40AF; line-height:1.6; font-family:'Segoe UI',Arial,sans-serif;">
        <strong>Don't lose access!</strong><br/>
        Renew now to avoid any interruption to your services and continue enjoying all premium features.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center; margin:28px 0;">
      <a href="${process.env.CLIENT_URL || 'https://childcenter.com'}/subscription/renew" 
         style="display:inline-block; background-color:#E8B923; color:#0A0E27; text-decoration:none; padding:14px 36px; border-radius:8px; font-weight:700; font-size:15px; font-family:'Segoe UI',Arial,sans-serif; box-shadow:0 4px 12px rgba(232,185,35,0.3);">
        Renew Now
      </a>
    </div>

    <!-- Support Note -->
    <p style="font-size:13px; color:#A0A8B8; text-align:center; margin:20px 0 0; font-family:'Segoe UI',Arial,sans-serif; line-height:1.5;">
      Questions? Contact us at <a href="mailto:support@childcenter.com" style="color:#E8B923; text-decoration:none;">support@childcenter.com</a>
    </p>
  </div>

  ${footerBlock('© 2026 Child Center. All rights reserved.')}
`);
