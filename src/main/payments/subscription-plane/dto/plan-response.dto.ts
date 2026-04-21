import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FeatureResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: Date;
}

export class PlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: string;

  @ApiProperty()
  isCustom: boolean;

  @ApiPropertyOptional()
  spaceLimit?: string | null;

  @ApiProperty({ type: [FeatureResponseDto] })
  features: FeatureResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  _count?: {
    subscriptions: number;
  };
}

export class PaginatedPlanResponseDto {
  @ApiProperty({ type: [PlanResponseDto] })
  data: PlanResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
