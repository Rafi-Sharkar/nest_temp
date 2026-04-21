import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStripePaymentDto {
  @ApiProperty({
    description: 'Plan ID to subscribe to',
    example: 'bce81811-2bee-49c3-902f-2a7e57cb8515',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;
}

export class CreateRevenueCatPaymentDto {
  @ApiProperty({
    description: 'Plan ID to subscribe to',
    example: 'bce81811-2bee-49c3-902f-2a7e57cb8515',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;
}
