import {
  GetUser,
  ValidateAdmin,
  ValidateUser,
} from '@/core/jwt/jwt.decorator';
import { JwtAuthGuard } from '@/core/jwt/jwt.guard';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateStripePaymentDto } from '../dto/create-stripe-payment.dto';
import { StripePaymentService } from '../service/stripe-payment.service';

@ApiTags('Payments---------------------- stripe-payment')
@Controller('stripe-payment')
export class StripePaymentController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}
  // --------------- endpoint to create Stripe checkout session for subscription --------------
  @ApiOperation({ summary: 'Create Stripe checkout session for subscription' })
  @ApiBearerAuth()
  @ValidateAdmin()
  @Post('create-intent')
  async createPaymentIntent(
    @GetUser('sub') userId: string,
    @Body() createDto: CreateStripePaymentDto,
  ) {
    return this.stripePaymentService.createStripePaymentIntent(
      { ...createDto, userId },
      userId,
    );
  }

  // --------------- endpoint to verify payment status --------------
  @ApiOperation({ summary: 'Verify payment status' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('verify/:paymentIntentId')
  async verifyPayment(@Param('paymentIntentId') paymentIntentId: string) {
    return this.stripePaymentService.verifyPayment(paymentIntentId);
  }
}
