import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'Optional name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/profile-photo.jpg',
    description: 'Optional profile photo',
  })
  @IsOptional()
  @IsString()
  profilePhoto?: string;
}
