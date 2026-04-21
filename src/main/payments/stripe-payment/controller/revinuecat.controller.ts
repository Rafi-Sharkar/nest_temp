import { Body, Controller, Post, Headers, UseGuards } from '@nestjs/common';
import { RevenueCatService } from '../service/revenuecat.service';
import { CreateRevenueCatPaymentDto } from '../dto/create-stripe-payment.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GetUser, ValidateUser } from '../../../../core/jwt/jwt.decorator';

@ApiTags('RevenueCat------------------ revenue-cat FOR testing purposes')
@Controller('revenuecat')
export class RevenueCatController {
  constructor(private readonly revenueCatService: RevenueCatService) {}

  @ApiOperation({ summary: 'Create a RevenueCat subscription payment' })
  @Post('subscribe-revenuecat')
  @ValidateUser()
  @ApiBearerAuth()
  async createPayment(
    @Body() dto: CreateRevenueCatPaymentDto,
    @GetUser('sub') userId: string,
  ) {
    return this.revenueCatService.createPayment(userId, dto);
  }

  //   -------- Handle RevenueCat webhook events --------
  @ApiOperation({ summary: 'Handle RevenueCat webhook events' })
  @Post('revenuecat-webhook')
  async handleWebhook(
    @Body() payload: string,
    @Headers('x-revenuecat-signature') signature: string,
  ) {
    try {
      await this.revenueCatService.handleEvent(payload, signature);
      return { status: 'success' };
    } catch (error: any) {
      return { status: 'error', message: error.message };
    }
  }
}
