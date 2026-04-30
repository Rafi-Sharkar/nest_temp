import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { TokenPair } from '@/core/jwt/jwt.interface';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { UserCacheService } from '@/lib/redis/user-cache.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { LogoutDto, RefreshTokenDto } from '../dto/logout.dto';

@Injectable()
export class AuthLogoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly userCache: UserCacheService,
  ) {}

  @HandleError('Logout user failed', 'User')
  async logout(userId: string, dto: LogoutDto): Promise<TResponse<any>> {
    const tokenRecord = await this.utils.findRefreshToken(dto.refreshToken);

    if (!tokenRecord || tokenRecord.userId !== userId) {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'Invalid refresh token');
    }

    await this.utils.revokeAllRefreshTokensForUser(userId);

    // Invalidate user session and profile cache on logout
    await this.userCache.invalidateUserSession(userId);
    console.log(`🗑️ User session cache invalidated on logout: ${userId}`);

    return successResponse(null, 'Logout successful');
  }

  @HandleError('Refresh token failed')
  async refresh(dto: RefreshTokenDto): Promise<TResponse<TokenPair>> {
    const tokenRecord = await this.utils.findRefreshToken(dto.refreshToken);

    if (!tokenRecord) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'Invalid or expired refresh token',
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.utils.revokeRefreshToken(dto.refreshToken);
      throw new AppError(HttpStatus.UNAUTHORIZED, 'Refresh token expired');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user) {
      await this.utils.revokeRefreshToken(dto.refreshToken);
      throw new AppError(HttpStatus.UNAUTHORIZED, 'User not found');
    }

    await this.utils.revokeRefreshToken(dto.refreshToken);

    const tokenPair = await this.utils.generateTokenPairAndSave({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return successResponse(tokenPair, 'Token refreshed successfully');
  }
}
