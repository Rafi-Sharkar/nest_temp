import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({
    description: 'Feature name',
    example: 'Unlimited Storage',
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}
