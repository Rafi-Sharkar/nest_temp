import { ValidateAdmin, ValidateUser } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFeatureDto } from '../dto/create-feature.dto';
import { CreateSubscriptionPlaneDto } from '../dto/create-subscription-plane.dto';
import { QueryPlanDto } from '../dto/query-plan.dto';
import { UpdateFeatureDto } from '../dto/update-feature.dto';
import { UpdateSubscriptionPlaneDto } from '../dto/update-subscription-plane.dto';
import { SubscriptionPlaneService } from '../service/subscription-plane.service';

@ApiTags(
  'Subscription Plans ------------------ super admin manage subscription plans and features management',
)
@Controller('subscription-plane')
export class SubscriptionPlaneController {
  constructor(
    private readonly subscriptionPlaneService: SubscriptionPlaneService,
  ) {}

  // ==================== FEATURE ENDPOINTS ====================

  @ApiOperation({ summary: 'Get all features' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Get('features-getall')
  findAllFeatures() {
    return this.subscriptionPlaneService.findAllFeatures();
  }

  // ==================== PLAN ENDPOINTS ====================

  @ApiOperation({ summary: 'Create a new subscription plan' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Post()
  createSubscriptionPlane(
    @Body() createSubscriptionPlaneDto: CreateSubscriptionPlaneDto,
  ) {
    return this.subscriptionPlaneService.createSubscriptionPlane(
      createSubscriptionPlaneDto,
    );
  }

  //  ----------------------- get all plans with pagination and optional search-----------------
  @ApiOperation({ summary: 'Get all subscription plans with pagination' })
  @Get()
  findAll(@Query() query: QueryPlanDto) {
    return this.subscriptionPlaneService.findAll(query);
  }

  @ApiOperation({ summary: 'Get a specific subscription plan by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subscriptionPlaneService.findOne(id);
  }

  // ----------------------- update subscription plan-----------------
  @ApiOperation({ summary: 'Update a subscription plan' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSubscriptionPlaneDto: UpdateSubscriptionPlaneDto,
  ) {
    return this.subscriptionPlaneService.update(id, updateSubscriptionPlaneDto);
  }

  // ----------------------- delete subscription plan-----------------
  @ApiOperation({ summary: 'Delete a subscription plan' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subscriptionPlaneService.remove(id);
  }

  // ----------------------- create new feature-----------------
  @ApiOperation({ summary: 'Create a new feature' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Post('features-create')
  createFeature(@Body() createFeatureDto: CreateFeatureDto) {
    return this.subscriptionPlaneService.createFeature(createFeatureDto);
  }
  //  -------------- get single feature------------------
  @ApiOperation({ summary: 'Get a specific feature by ID' })
  @ApiParam({ name: 'id', description: 'Feature UUID' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Get('features/:id')
  findOneFeature(@Param('id') id: string) {
    return this.subscriptionPlaneService.findOneFeature(id);
  }
  // ----------------------- update feature-----------------
  @ApiOperation({ summary: 'Update a feature' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Patch('features/:id')
  updateFeature(
    @Param('id') id: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
  ) {
    return this.subscriptionPlaneService.updateFeature(id, updateFeatureDto);
  }

  // ----------------------- delete feature-----------------
  @ApiOperation({ summary: 'Delete a feature' })
  @ValidateAdmin()
  @ApiBearerAuth()
  @Delete('features/:id')
  removeFeature(@Param('id') id: string) {
    return this.subscriptionPlaneService.removeFeature(id);
  }
}
