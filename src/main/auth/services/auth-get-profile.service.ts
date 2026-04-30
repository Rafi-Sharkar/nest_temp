import { successResponse } from '@/common/utils/response.util';
import { HandleError } from '@/core/error/handle-error.decorator';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { UserCacheService } from '@/lib/redis/user-cache.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class AuthGetProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authUtils: AuthUtilsService,
    private readonly userCache: UserCacheService,
  ) {}

  @HandleError("Can't get user profile")
  async getProfile(userId: string) {
    // Try to get from cache first
    const cachedUser = await this.userCache.getCachedUserProfile(userId);
    if (cachedUser) {
      console.log(`✅ User profile fetched from cache: ${userId}`);
      return successResponse(cachedUser, 'User data fetched from cache');
    }

    const user = await this.findUserBy('id', userId);
    
    // Cache the user profile for future requests
    if (user.data) {
      await this.userCache.cacheUserProfile(userId, user.data, 3600); // Cache for 1 hour
    }
    
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
