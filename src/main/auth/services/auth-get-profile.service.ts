import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class AuthGetProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  @HandleError("Can't get user profile")
  async getProfile(userId: string) {
    const user = await this.findUserBy('id', userId);
    return user;
  }

  private async findUserBy(key: 'id' | 'email', value: string) {
    const where: any = {};
    where[key] = value;

    const user = await this.prisma.client.user.findUnique({
      where,
      include: {
        notifications: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { notifications, subscription, ...mainUser } = user;
    const sanitizedUser = await this.authUtils.sanitizeUser(mainUser as any);

    const data = {
      ...sanitizedUser,
      notifications,
      subscription,
    };

    return successResponse(data, 'User data fetched successfully');
  }
}
