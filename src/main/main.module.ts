import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DevToolModule } from './dev-tool/dev-tool.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadModule } from './upload-s3/upload.module';
import { VpsFileUploadModule } from './vps-fileupload/vps-fileupload.module';
import { SharedModule } from './shared/shared.module';
import { PrivateMessageModule } from './private-message/private-message.module';

@Module({
  imports: [
    AuthModule,
    UploadModule,
    VpsFileUploadModule,
    PaymentsModule,
    DevToolModule,
    NotificationsModule,
    SharedModule,
    PrivateMessageModule,
  ],
})
export class MainModule {}
