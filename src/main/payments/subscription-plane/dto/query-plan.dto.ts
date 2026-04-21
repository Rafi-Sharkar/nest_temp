import { PaginationDto } from '@/common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryPlanDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by plan name',
    example: 'Premium',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // @ApiPropertyOptional({
  //   description: 'Filter by custom plans',
  //   example: false,
  // })
  // @IsOptional()
  // @Type(() => Boolean)
  // @IsBoolean()
  // isCustom?: boolean;
}
