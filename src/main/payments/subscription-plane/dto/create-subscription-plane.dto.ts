import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanName } from '@prisma';

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSubscriptionPlaneDto {
  @ApiProperty({
    description: 'Plan name',
    example: 'FREE',
  })
  @IsNotEmpty()
  @IsEnum(PlanName)
  name: PlanName;

  @ApiProperty({
    description: 'Plan price',
    example: '99.99',
  })
  @IsNotEmpty()
  @IsString()
  price: string;

  @ApiPropertyOptional({
    description: 'Is this a custom plan',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;

  @ApiPropertyOptional({
    description: 'Space limit for the plan',
    example: '10',
  })
  @IsOptional()
  @IsString()
  minSpace?: string;

  @ApiPropertyOptional({
    description: 'Space limit for the plan',
    example: '100',
  })
  @IsOptional()
  @IsString()
  maxSpace?: string;
  @ApiPropertyOptional({
    description: 'Array of feature IDs to associate with this plan',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  featureIds?: string[];
}
