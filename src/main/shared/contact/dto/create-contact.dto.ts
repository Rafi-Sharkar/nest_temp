import { ApiProperty } from '@nestjs/swagger';

import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ example: 'Md' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'softvanceweb@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'GENERAL INQUIRY ' })
  @IsOptional()
  @IsString()
  subject: string;

  @ApiProperty({ example: 'I need a baby replacement' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SubscribeToCustomOffersDto {
  @ApiProperty({ example: 'i have need to subscribe to custom offers' })
  @IsNotEmpty()
  message: string;
  @ApiProperty({ example: '50' })
  @IsNotEmpty()
  customPrice: string;
  // --------feature array of strings------------
  @ApiProperty({
    example: ['feature 1', 'feature 2', 'feature 3'],
    type: [String],
  })
  @IsNotEmpty()
  features: string[];
}
