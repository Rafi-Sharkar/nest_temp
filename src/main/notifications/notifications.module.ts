import { Module } from '@nestjs/common';

import { NotificationGateway } from './socket-notification/NotificationGateway/notification.gateway';
import { NotificationListener } from './socket-notification/NotificationListiner/notification.listiner';
import { SocketNotificationModule } from './socket-notification/socket-notification.module';

@Module({
  controllers: [],
  providers: [NotificationGateway, NotificationListener],
  imports: [SocketNotificationModule],
})
export class NotificationsModule {}
