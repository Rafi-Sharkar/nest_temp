import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionPlaneDto } from './create-subscription-plane.dto';

export class UpdateSubscriptionPlaneDto extends PartialType(
  CreateSubscriptionPlaneDto,
) {}
