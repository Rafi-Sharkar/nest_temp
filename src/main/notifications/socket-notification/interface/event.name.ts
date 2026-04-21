// ============ META INTERFACES ============
export interface UserRegistrationMeta {
  action: 'created';
  info: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    createdAt: Date;
    recipients: Array<{
      id: string;
      email: string;
    }>;
  };
  meta?: Record<string, any>;
}

export interface paymentMeta {
  action: 'created';
  info: {
    id: string;
    name: string;
    price: string;
    subscriptions: [];
    feature: [];
    createdAt: Date;
    recipients: Array<{
      id: string;
      email: string;
    }>;
  };
  meta?: Record<string, any>;
}

export interface contactMessageMeta {
  action: 'created';
  info: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    recipients: Array<{
      id: string;
      email: string;
    }>;
  };
  meta?: Record<string, any>;
}

export interface contactSubscriptionMeta {
  action: 'created';
  info: {
    id: string;
    name?: string;
    email?: string;
    createdAt: Date;
    recipients: Array<{
      id: string;
      email: string;
    }>;
  };
  meta?: Record<string, any>;
}

// ============ EVENT TYPES ============
export const EVENT_TYPES = {
  USERREGISTRATION_CREATE: 'user.create',
  USERREGISTRATION_UPDATE: 'user.update',
  USERREGISTRATION_DELETE: 'user.delete',
  PAYMENT_CREATE: 'payment.create',
  CONTACT_CREATE: 'contact.create',
  CONTACT_SUBSCRIBE_CREATE: 'contact.subscribe.create',
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export type EventPayloadMap = {
  [EVENT_TYPES.USERREGISTRATION_CREATE]: UserRegistrationMeta;
  [EVENT_TYPES.USERREGISTRATION_UPDATE]: UserRegistrationMeta;
  [EVENT_TYPES.USERREGISTRATION_DELETE]: UserRegistrationMeta;
  [EVENT_TYPES.PAYMENT_CREATE]: paymentMeta;
  [EVENT_TYPES.CONTACT_CREATE]: contactMessageMeta;
  [EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE]: contactSubscriptionMeta;
};
