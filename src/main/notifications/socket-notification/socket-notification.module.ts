import { Module } from '@nestjs/common';
import { NotificationController } from './socket-notification.controller';
import { NotificationService } from './socket-notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class SocketNotificationModule {}
