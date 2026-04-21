import {
  contactMessageMeta,
  contactSubscriptionMeta,
  paymentMeta,
  UserRegistrationMeta,
} from './event.name';

// ============ BASE INTERFACES ============
export interface BaseEvent<TMeta> {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'USE';
  meta: TMeta;
}

export interface Notification {
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  meta: Record<string, any>;
}

// ============ EVENT INTERFACES ============

export type UserRegistration = BaseEvent<UserRegistrationMeta>;
export type payment = BaseEvent<paymentMeta>;
export type contactMessage = BaseEvent<contactMessageMeta>;
export type contactSubscription = BaseEvent<contactSubscriptionMeta>;
