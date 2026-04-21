import { SubscriptionStatus } from '@prisma';

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.EXPIRING_SOON,
  SubscriptionStatus.EXPIRING_TOMORROW,
];

export const SUBSCRIPTION_REMINDER_DAYS = {
  SEVEN_DAYS: 7,
  ONE_DAY: 1,
} as const;

export const isActiveSubscriptionStatus = (
  status: SubscriptionStatus,
): boolean => ACTIVE_SUBSCRIPTION_STATUSES.includes(status);
