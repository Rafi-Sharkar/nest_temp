import { Injectable, NotFoundException } from '@nestjs/common';

import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { successResponse, TResponse } from '@/common/utils/response.util';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}
  // --------------- Get all notifications for a user --------------------------
  @HandleError('Failed to get all notifications')
  async getAllNotifications(userId: string): Promise<TResponse<any>> {
    const userNotifications =
      await this.prisma.client.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { notification: true },
      });

    const totalCount = userNotifications.length;
    const unreadCount = userNotifications.filter((un) => !un.read).length;

    const formatted = userNotifications.map((un) => ({
      id: un.notification.id,
      userNotificationId: un.id,
      type: un.notification.type,
      title: un.notification.title,
      message: un.notification.message,
      meta: un.notification.meta ?? {},
      read: un.read,
      createdAt: un.createdAt,
    }));

    return successResponse(
      {
        total: totalCount,
        unread: unreadCount,
        notifications: formatted,
      },
      'Notifications retrieved successfully',
    );
  }
  // ------- Get unread notifications ------
  @HandleError('Failed to get unread notifications')
  async getUnreadNotifications(userId: string): Promise<TResponse<any>> {
    const userNotifications =
      await this.prisma.client.userNotification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        include: { notification: true },
      });

    const unreadCount = userNotifications.length;

    const formatted = userNotifications.map((un: any) => ({
      id: un.notification.id,
      userNotificationId: un.id,
      type: un.notification.type,
      title: un.notification.title,
      message: un.notification.message,
      meta: un.notification.meta ?? {},
      read: un.read,
      createdAt: un.createdAt,
    }));

    return successResponse(
      {
        unread: unreadCount,
        totalUnread: unreadCount,
        notifications: formatted,
      },
      unreadCount > 0
        ? 'Unread notifications retrieved'
        : 'No unread notifications',
    );
  }

  // ------- Read single notification setting------
  @HandleError('Failed to mark notification as read')
  async readSingleNotification(
    userId: string,
    notificationId: string,
  ): Promise<TResponse<any>> {
    const userNotif = await this.prisma.client.userNotification.findUnique({
      where: {
        userId_notificationId: { userId, notificationId },
      },
      include: { notification: true },
    });

    if (!userNotif) {
      throw new NotFoundException('Notification not found for this user');
    }

    if (userNotif.read) {
      return successResponse(
        { id: notificationId, read: true },
        'Notification was already read',
      );
    }

    await this.prisma.client.userNotification.update({
      where: { id: userNotif.id },
      data: { read: true },
      include: { notification: true },
    });

    // Optional: return current unread count after this action
    const remainingUnread = await this.prisma.client.userNotification.count({
      where: { userId, read: false },
    });

    return successResponse(
      {
        id: notificationId,
        read: true,
        remainingUnread,
      },
      'Notification marked as read',
    );
  }
  // ------------------ Read all notifications ----------------------
  @HandleError('Failed to read all notifications')
  async readAllNotifications(userId: string): Promise<TResponse<any>> {
    const { count } = await this.prisma.client.userNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return successResponse(
      {
        markedAsRead: count,
        remainingUnread: 0,
      },
      count > 0
        ? 'All notifications marked as read'
        : 'No unread notifications to mark',
    );
  }
  // ------------------ Mark all notifications as read ----------------------
  @HandleError('Failed to mark all notifications as read')
  async makeAllNotificationRead(userId: string): Promise<TResponse<any>> {
    const { count } = await this.prisma.client.userNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return successResponse(
      {
        markedAsRead: count,
        remainingUnread: 0,
      },
      count > 0
        ? 'All notifications marked as read'
        : 'No unread notifications to mark',
    );
  }

  // ------------------ Delete single notification ----------------------

  @HandleError('Failed to delete single notification')
  async deleteSingleNotifications(
    userId: string,
    notificationId: string,
  ): Promise<TResponse<any>> {
    const exists = await this.prisma.client.userNotification.findUnique({
      where: {
        userId_notificationId: { userId, notificationId },
      },
    });

    if (!exists) {
      throw new NotFoundException('Notification not found for this user');
    }

    await this.prisma.client.userNotification.delete({
      where: { id: exists.id },
    });

    // Optional: return updated counts
    const [total, unread] = await Promise.all([
      this.prisma.client.userNotification.count({
        where: { userId },
      }),
      this.prisma.client.userNotification.count({
        where: { userId, read: false },
      }),
    ]);

    return successResponse(
      { total, unread },
      'Notification deleted successfully',
    );
  }
  // ------------------ Delete all notifications ----------------------
  @HandleError('Failed to delete all notifications')
  async deleteAllNotification(userId: string): Promise<TResponse<any>> {
    const { count } = await this.prisma.client.userNotification.deleteMany({
      where: { userId },
    });

    return successResponse(
      {
        deleted: count,
        remaining: 0,
      },
      count > 0 ? 'All notifications deleted' : 'No notifications to delete',
    );
  }

  // -------------- Get notification counts --------------------------
  @HandleError('Failed to get notification counts')
  async getNotificationCounts(userId: string) {
    const [total, unread] = await Promise.all([
      this.prisma.client.userNotification.count({ where: { userId } }),
      this.prisma.client.userNotification.count({
        where: { userId, read: false },
      }),
    ]);

    return { total, unread };
  }
}
