import {
  GetUser,
  ValidateAdmin,
  ValidateUser,
} from '@/core/jwt/jwt.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionSchedulerService } from '../../subscription-plane/service/subscription-scheduler.service';
import {
  CreateSubscriptionDto,
  SubscriptionService,
} from '../service/subscription.service';

@ApiTags(
  'Subscriptions---------------------------  Subscription management for users and admins',
)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly schedulerService: SubscriptionSchedulerService,
  ) {}

  // --------------------- Super admin endpoints for managing all subscriptions ----------------
  @Post()
  @ValidateAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create subscription for a user' })
  async createSubscription(@Body() createDto: CreateSubscriptionDto) {
    return this.subscriptionService.createSubscription(createDto);
  }

  //  --------------------- User endpoints for managing their own subscription ----------------
  @Get('my-subscription')
  @ValidateUser()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription' })
  async getMySubscription(@GetUser('sub') userId: string) {
    return this.subscriptionService.getUserSubscription(userId);
  }

  // --------------------- User endpoints for managing their own subscription ----------------
  @Get('check-active-payment')
  @ValidateUser()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user has active subscription' })
  async checkActiveSubscription(@GetUser('sub') userId: string) {
    return await this.subscriptionService.hasActiveSubscription(userId);
  }
  // --------------------- User endpoints for managing their own subscription ----------------
  @Post('cancel')
  @ValidateUser()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel current user subscription' })
  async cancelSubscription(@GetUser('sub') userId: string) {
    return this.subscriptionService.cancelSubscription(userId);
  }
  // --------------------- User endpoints for managing their own subscription ----------------
  @Post('renew')
  @ValidateUser()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renew current user subscription' })
  async renewSubscription(
    @GetUser('sub') userId: string,
    @Body('durationMonths') durationMonths?: number,
  ) {
    return this.subscriptionService.renewSubscription(userId, durationMonths);
  }

  // ---------- Super admin endpoints for managing all subscriptions ----------
  @Get('all')
  @ApiOperation({ summary: 'Get all subscriptions ( super admin)' })
  async getAllSubscriptions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.subscriptionService.getAllSubscriptions(page, limit);
  }

  // ----------------- Super admin only ----------------
  @Get('user/:userId')
  @ValidateAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription by user ID (super admin)' })
  async getUserSubscriptionById(@Param('userId') userId: string) {
    return this.subscriptionService.getUserSubscription(userId);
  }
}
