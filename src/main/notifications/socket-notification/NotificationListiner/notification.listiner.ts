import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EVENT_TYPES } from '../interface/event.name';

import { PrismaService } from '@/lib/prisma/prisma.service';
import {
  contactMessage,
  contactSubscription,
  Notification,
  payment,
  UserRegistration,
} from '../interface/events.payload';
import { NotificationGateway } from '../NotificationGateway/notification.gateway';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationGateway: NotificationGateway,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(EVENT_TYPES.USERREGISTRATION_CREATE)
  async handleUserRegistrationCreated(payload: UserRegistration) {
    this.logger.log('User Registration EVENT RECEIVED');
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
    const info = payload.meta.info;

    if (!info?.recipients?.length) {
      this.logger.warn('No recipients found → skipping');
      return;
    }

    this.logger.log(`Total recipients: ${info.recipients.length}`);

    // Check if user has notification toggle enabled
    const enabledRecipients =
      await this.prisma.client.notificationToggle.findMany({
        where: {
          userId: { in: info.recipients.map((r) => r.id) },
          userRegistration: true,
        },
        select: { userId: true },
      });

    const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));

    for (const recipient of info.recipients) {
      if (!enabledUserIds.has(recipient.id)) {
        this.logger.log(
          `User ${recipient.id} has disabled userRegistration notifications`,
        );
        continue;
      }

      this.logger.log(
        `--- Processing recipient: ${recipient.id} (${recipient.email}) ---`,
      );

      const notificationData: Notification = {
        type: EVENT_TYPES.USERREGISTRATION_CREATE,
        title: 'New User Registered',
        message: `${info.name} has registered`,
        createdAt: new Date(),
        meta: {
          id: info.id,
          email: info.email,
          name: info.name,
          phone: info.phone,
          createdAt: info.createdAt,
          ...payload.meta.meta,
        },
      };

      // Send real-time notification via socket
      const clients = this.notificationGateway.getClientsForUser(recipient.id);
      this.logger.log(`  → Connected sockets: ${clients.size}`);

      for (const client of clients) {
        this.logger.log(`  Sending notification to socket ${client.id}`);
        client.emit(EVENT_TYPES.USERREGISTRATION_CREATE, notificationData);
        this.logger.log(
          `  ✔ Notification sent to ${recipient.id} via socket ${client.id}`,
        );
      }
    }

    this.logger.log('USERREGISTRATION_CREATE event processing complete');
  }

  @OnEvent(EVENT_TYPES.PAYMENT_CREATE)
  async handlePaymentCreated(payload: payment) {
    this.logger.log('Payment Creation EVENT RECEIVED');
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);
    const info = payload.meta.info;

    if (!info?.recipients?.length) {
      this.logger.warn('No recipients found → skipping');
      return;
    }

    this.logger.log(`Total recipients: ${info.recipients.length}`);

    const enabledRecipients =
      await this.prisma.client.notificationToggle.findMany({
        where: {
          userId: { in: info.recipients.map((r: any) => r.id) },
          payment: true,
        },
        select: { userId: true },
      });

    const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));

    for (const recipient of info.recipients) {
      if (!enabledUserIds.has(recipient.id)) {
        this.logger.log(
          `User ${recipient.id} has disabled payment notifications`,
        );
        continue;
      }

      this.logger.log(
        `--- Processing recipient: ${recipient.id} (${recipient.email}) ---`,
      );

      const notificationData: Notification = {
        type: EVENT_TYPES.PAYMENT_CREATE,
        title: 'New Payment Received',
        message: `Payment of $${info.price} has been received`,
        createdAt: new Date(),
        meta: {
          id: info.id,
          name: info.name,
          price: info.price,
          subscriptions: info.subscriptions,
          feature: info.feature,
          createdAt: info.createdAt,
          ...payload.meta.meta,
        },
      };

      const clients = this.notificationGateway.getClientsForUser(recipient.id);
      this.logger.log(`  → Connected sockets: ${clients.size}`);

      for (const client of clients) {
        this.logger.log(`  Sending notification to socket ${client.id}`);
        client.emit(EVENT_TYPES.PAYMENT_CREATE, notificationData);
        this.logger.log(
          `  ✔ Notification sent to ${recipient.id} via socket ${client.id}`,
        );
      }
    }

    this.logger.log('PAYMENT_CREATE event processing complete');
  }

  @OnEvent(EVENT_TYPES.CONTACT_CREATE)
  async handleContactCreated(payload: contactMessage) {
    this.logger.log('Contact Creation EVENT RECEIVED');
    const info = payload.meta.info;

    if (!info?.recipients?.length) {
      this.logger.warn('No recipients found -> skipping');
      return;
    }

    const enabledRecipients =
      await this.prisma.client.notificationToggle.findMany({
        where: {
          userId: { in: info.recipients.map((r) => r.id) },
          message: true,
        },
        select: { userId: true },
      });

    const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));
    const deliverableRecipientIds: string[] = [];

    for (const recipient of info.recipients) {
      if (!enabledUserIds.has(recipient.id)) {
        this.logger.log(
          `User ${recipient.id} has disabled message notifications`,
        );
        continue;
      }

      deliverableRecipientIds.push(recipient.id);

      const notificationData: Notification = {
        type: EVENT_TYPES.CONTACT_CREATE,
        title: 'New Contact Message',
        message: `${info.name} submitted a contact request`,
        createdAt: new Date(),
        meta: {
          id: info.id,
          name: info.name,
          email: info.email,
          createdAt: info.createdAt,
          ...payload.meta.meta,
        },
      };

      const clients = this.notificationGateway.getClientsForUser(recipient.id);
      for (const client of clients) {
        client.emit(EVENT_TYPES.CONTACT_CREATE, notificationData);
      }
    }

    if (deliverableRecipientIds.length > 0) {
      await this.persistNotificationForUsers(
        {
          type: EVENT_TYPES.CONTACT_CREATE,
          title: 'New Contact Message',
          message: `${info.name} submitted a contact request`,
          createdAt: new Date(),
          meta: {
            id: info.id,
            name: info.name,
            email: info.email,
            createdAt: info.createdAt,
            ...payload.meta.meta,
          },
        },
        deliverableRecipientIds,
      );
    }
  }

  @OnEvent(EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE)
  async handleContactSubscribeCreated(payload: contactSubscription) {
    this.logger.log('Contact Subscribe EVENT RECEIVED');
    const info = payload.meta.info;

    if (!info?.recipients?.length) {
      this.logger.warn('No recipients found -> skipping');
      return;
    }

    const enabledRecipients =
      await this.prisma.client.notificationToggle.findMany({
        where: {
          userId: { in: info.recipients.map((r) => r.id) },
          message: true,
        },
        select: { userId: true },
      });

    const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));
    const deliverableRecipientIds: string[] = [];

    for (const recipient of info.recipients) {
      if (!enabledUserIds.has(recipient.id)) {
        this.logger.log(
          `User ${recipient.id} has disabled message notifications`,
        );
        continue;
      }

      deliverableRecipientIds.push(recipient.id);

      const notificationData: Notification = {
        type: EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE,
        title: 'New Offer Subscription',
        message: `${info.name ?? 'A user'} subscribed to custom offers`,
        createdAt: new Date(),
        meta: {
          id: info.id,
          name: info.name,
          email: info.email,
          createdAt: info.createdAt,
          ...payload.meta.meta,
        },
      };

      const clients = this.notificationGateway.getClientsForUser(recipient.id);
      for (const client of clients) {
        client.emit(EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE, notificationData);
      }
    }

    if (deliverableRecipientIds.length > 0) {
      await this.persistNotificationForUsers(
        {
          type: EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE,
          title: 'New Offer Subscription',
          message: `${info.name ?? 'A user'} subscribed to custom offers`,
          createdAt: new Date(),
          meta: {
            id: info.id,
            name: info.name,
            email: info.email,
            createdAt: info.createdAt,
            ...payload.meta.meta,
          },
        },
        deliverableRecipientIds,
      );
    }
  }

  private async persistNotificationForUsers(
    notificationData: Notification,
    userIds: string[],
  ) {
    const createdNotification = await this.prisma.client.notification.create({
      data: {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        meta: notificationData.meta,
      },
    });

    await this.prisma.client.userNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        notificationId: createdNotification.id,
        read: false,
      })),
    });
  }
}
