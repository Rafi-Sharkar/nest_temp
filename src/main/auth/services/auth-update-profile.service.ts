import { successResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class AuthUpdateProfileService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to update profile', 'User')
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }
    console.log('Updating profile for user:', userId, 'with data:', dto);

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim() ? dto.name.trim() : user.name,
        profilePhoto: dto.profilePhoto?.trim()
          ? dto.profilePhoto.trim()
          : user.profilePhoto,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profilePhoto: true,
      },
    });

    return successResponse(updatedUser, 'Profile updated successfully');
  }
}
