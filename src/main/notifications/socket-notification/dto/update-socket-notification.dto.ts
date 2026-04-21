import { PartialType } from '@nestjs/swagger';
import { CreateSocketNotificationDto } from './create-socket-notification.dto';

export class UpdateSocketNotificationDto extends PartialType(
  CreateSocketNotificationDto,
) {}
