/**
 * Redis Cache Usage Examples
 * ============================
 * 
 * This file shows practical examples of using Redis caching
 * in your NestJS application
 */

// ============================================
// Example 1: Basic User Cache Service Usage
// ============================================

import { Injectable } from '@nestjs/common';
import { UserCacheService } from '@/lib/redis/user-cache.service';
import { PrismaService } from '@/lib/prisma/prisma.service';

@Injectable()
export class UserProfileService {
  constructor(
    private userCache: UserCacheService,
    private prisma: PrismaService,
  ) {}

  // Get user with cache (Example from auth-get-profile.service.ts)
  async getUserProfile(userId: string) {
    // Try cache first
    const cached = await this.userCache.getCachedUserProfile(userId);
    if (cached) return cached;

    // Query database
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    // Cache for 1 hour
    await this.userCache.cacheUserProfile(userId, user, 3600);
    return user;
  }

  // Update user with cache invalidation
  async updateUserProfile(userId: string, data: any) {
    const updated = await this.prisma.client.user.update({
      where: { id: userId },
      data,
    });

    // Clear cache so next request fetches fresh data
    await this.userCache.invalidateUserProfile(userId);
    return updated;
  }

  // Email verification with OTP cache
  async sendVerificationOTP(userId: string, email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Store OTP in cache (10 minutes)
    await this.userCache.storeOTP(userId, otp.toString(), 'EMAIL_VERIFICATION');

    // Send email with OTP
    // ... send email logic ...

    return { success: true, message: 'OTP sent to email' };
  }

  // Verify OTP
  async verifyOTP(userId: string, otp: string) {
    const isValid = await this.userCache.verifyAndDeleteOTP(
      userId,
      otp,
      'EMAIL_VERIFICATION',
    );

    if (!isValid) {
      throw new Error('Invalid or expired OTP');
    }

    return { success: true, message: 'Email verified' };
  }
}

// ============================================
// Example 2: Using Cache Interceptor
// ============================================

import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { CacheKey, InvalidateCache } from '@/lib/redis/cache.interceptor';

@Controller('users')
export class UsersControllerWithCache {
  constructor(private userService: UserProfileService) {}

  // Automatically caches the response for 1 hour
  @Get(':id')
  @CacheKey('user:profile', 3600)
  async getUser(@Param('id') id: string) {
    return this.userService.getUserProfile(id);
  }

  // Clears cache matching pattern after request
  @Put(':id')
  @InvalidateCache('user:profile:*')
  async updateUser(@Param('id') id: string, @Body() data: any) {
    return this.userService.updateUserProfile(id, data);
  }
}

// ============================================
// Example 3: Custom Cache Logic
// ============================================

import { RedisService } from '@/lib/redis/redis.service';

@Injectable()
export class NotificationCacheService {
  constructor(private redis: RedisService) {}

  // Cache user notifications
  async cacheNotifications(userId: string, notifications: any[]) {
    const key = `notifications:${userId}`;
    await this.redis.setJson(key, notifications, 1800); // 30 minutes
  }

  // Get notifications with cache
  async getNotifications(userId: string) {
    const key = `notifications:${userId}`;
    
    // Try cache
    let notifications = await this.redis.getJson(key);
    if (notifications) return notifications;

    // Fetch from DB if not cached
    // ... your logic ...

    return notifications;
  }

  // Real-time cache update on new notification
  async addNotification(userId: string, notification: any) {
    const key = `notifications:${userId}`;
    const notifications = await this.redis.getJson(key) || [];
    
    notifications.push(notification);
    
    // Update cache
    await this.redis.setJson(key, notifications, 1800);

    return notification;
  }

  // Increment counter in cache
  async incrementUnreadCount(userId: string) {
    const key = `unread:${userId}`;
    const client = this.redis.getClient();
    const count = await client.incr(key);
    
    return count;
  }

  // Decrement counter
  async decrementUnreadCount(userId: string) {
    const key = `unread:${userId}`;
    const client = this.redis.getClient();
    const count = await client.decr(key);
    
    return Math.max(0, count);
  }
}

// ============================================
// Example 4: Rate Limiting & Login Attempts
// ============================================

@Injectable()
export class LoginSecurityService {
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 15;

  constructor(private userCache: UserCacheService) {}

  async checkLoginAttempts(email: string): Promise<{
    allowed: boolean;
    attempts: number;
    remainingAttempts: number;
  }> {
    const attempts = await this.userCache.getLoginAttempts(email);
    const allowed = attempts < this.MAX_ATTEMPTS;

    return {
      allowed,
      attempts,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - attempts),
    };
  }

  async recordFailedLogin(email: string) {
    const attempts = await this.userCache.incrementLoginAttempts(
      email,
      this.LOCKOUT_MINUTES * 60,
    );

    if (attempts >= this.MAX_ATTEMPTS) {
      console.warn(
        `⚠️ Account locked for ${email} - too many failed attempts`,
      );
    }

    return attempts;
  }

  async recordSuccessfulLogin(email: string) {
    await this.userCache.resetLoginAttempts(email);
  }
}

// ============================================
// Example 5: Session Management
// ============================================

@Injectable()
export class SessionService {
  constructor(private userCache: UserCacheService) {}

  async createSession(userId: string, sessionData: any) {
    const session = {
      userId,
      createdAt: new Date(),
      ...sessionData,
    };

    // Store for 24 hours
    await this.userCache.storeUserSession(userId, session, 86400);
    return session;
  }

  async getSession(userId: string) {
    return this.userCache.getUserSession(userId);
  }

  async extendSession(userId: string) {
    const session = await this.userCache.getUserSession(userId);
    if (session) {
      session.lastActivityAt = new Date();
      await this.userCache.storeUserSession(userId, session, 86400);
    }
    return session;
  }

  async destroySession(userId: string) {
    await this.userCache.invalidateUserSession(userId);
  }
}

// ============================================
// Example 6: Advanced - Caching with Patterns
// ============================================

@Injectable()
export class UserPreferencesService {
  constructor(private redis: RedisService) {}

  async cacheUserPreferences(userId: string, preferences: any) {
    const key = `pref:${userId}`;
    await this.redis.setJson(key, preferences, 86400); // 24 hours
  }

  async getUserPreferences(userId: string) {
    const key = `pref:${userId}`;
    return this.redis.getJson(key);
  }

  async updatePreference(userId: string, key: string, value: any) {
    const prefKey = `pref:${userId}`;
    const prefs = await this.redis.getJson(prefKey) || {};
    
    prefs[key] = value;
    
    await this.redis.setJson(prefKey, prefs, 86400);
    return prefs;
  }

  async getAllUserCaches() {
    const client = this.redis.getClient();
    const keys = await client.keys('*');
    
    const caches = {};
    for (const key of keys) {
      const value = await this.redis.getJson(key);
      caches[key] = value;
    }
    
    return caches;
  }

  async clearUserCaches(pattern: string) {
    const client = this.redis.getClient();
    const keys = await client.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.deleteMany(keys);
    }
    
    return { cleared: keys.length };
  }
}

// ============================================
// Example 7: Testing Redis Cache
// ============================================

// In your test file:
import { Test } from '@nestjs/testing';
import { RedisService } from '@/lib/redis/redis.service';

describe('Redis Cache Integration Tests', () => {
  let redisService: RedisService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [RedisService, ConfigService],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
  });

  it('should cache and retrieve user data', async () => {
    const userId = 'test-user-123';
    const userData = { id: userId, name: 'John Doe', email: 'john@example.com' };

    // Set cache
    await redisService.setJson(`user:${userId}`, userData, 3600);

    // Retrieve cache
    const cached = await redisService.getJson(`user:${userId}`);
    expect(cached).toEqual(userData);
  });

  it('should expire cache after TTL', async () => {
    const key = 'test:ttl';
    const value = 'test-data';

    // Set with 1 second TTL
    await redisService.set(key, value, 1);

    // Should exist immediately
    let retrieved = await redisService.get(key);
    expect(retrieved).toBe(value);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be expired
    retrieved = await redisService.get(key);
    expect(retrieved).toBeNull();
  });

  it('should handle multiple operations', async () => {
    const keys = ['key1', 'key2', 'key3'];
    
    // Set multiple
    for (const key of keys) {
      await redisService.set(key, `value-${key}`);
    }

    // Check existence
    for (const key of keys) {
      const exists = await redisService.exists(key);
      expect(exists).toBe(true);
    }

    // Delete multiple
    await redisService.deleteMany(keys);

    // Check all deleted
    for (const key of keys) {
      const exists = await redisService.exists(key);
      expect(exists).toBe(false);
    }
  });
});
