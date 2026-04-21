import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CustomOfferSubscriptionFilterPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, message, custom price, or feature',
    example: 'premium',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter from created date (inclusive)',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter to created date (inclusive)',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class ContactMessageFilterPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, subject, or message',
    example: 'inquiry',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter from created date (inclusive)',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter to created date (inclusive)',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
