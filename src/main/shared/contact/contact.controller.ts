import {
  GetUser,
  ValidateAdmin,
  ValidateUser,
} from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import {
  CreateContactDto,
  SubscribeToCustomOffersDto,
} from './dto/create-contact.dto';
import {
  ContactMessageFilterPaginationDto,
  CustomOfferSubscriptionFilterPaginationDto,
} from './dto/filter-pagination.dto';

@ApiTags(
  'contact -------------------------- contact any person can contact us by this route here now and also subscribe to custom offers and super admin can get all contact messages and custom offer subscriptions and delete them',
)
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @ApiOperation({
    summary:
      'Create a new contact message || This route allows users to submit a contact message, which will be sent to the admin email and a confirmation email will be sent to the user. It also emits a real-time socket notification to all SUPER_ADMIN users.',
  })
  @Post()
  create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  // ---------------------- customer subscription offer ----------------------
  @ApiOperation({
    summary:
      'Subscribe to custom offers || This route allows users to subscribe to custom offers by providing their email address. The email will be added to the subscription list for receiving updates on custom offers. It also emits a real-time socket notification to all SUPER_ADMIN users.',
  })
  @ApiBearerAuth()
  @ValidateUser()
  @Post('subscribe')
  subscribe(
    @GetUser('sub') userId: string,
    @Body() payload: SubscribeToCustomOffersDto,
  ) {
    return this.contactService.subscribeToCustomOffers(payload, userId);
  }

  // ----------------------  get all custom offers  ----------------------
  @ApiOperation({
    summary:
      'Get all custom offers  By super admin || This route allows users to retrieve all custom offers that they have subscribed to.',
  })
  @ApiBearerAuth()
  @ValidateUser()
  @Get('subscriptions')
  getAllSubscriptions(
    @Query() query: CustomOfferSubscriptionFilterPaginationDto,
  ) {
    return this.contactService.getAllCustomOfferSubscriptions(query);
  }

  // ---------------------- get custom offer subscription by id ----------------------
  @ApiOperation({
    summary:
      'Get a specific custom offer subscription by ID || This route allows users to retrieve details of a specific custom offer subscription.',
  })
  @ApiBearerAuth()
  @ValidateUser()
  @Get('subscriptions/:id')
  getSubscriptionById(@Param('id') id: string) {
    return this.contactService.getCustomOfferSubscriptionById(id);
  }

  //------------------------ get all contract offers ----------------------
  @ApiOperation({
    summary:
      'Get all contact messages By super admin || This route allows users to retrieve all contact messages that they have submitted.',
  })
  @ApiBearerAuth()
  @ValidateUser()
  @Get('messages')
  getAllContactMessages(@Query() query: ContactMessageFilterPaginationDto) {
    return this.contactService.getAllContactMessages(query);
  }
  // ---------------------- send subscription ready email ----------------------
  @ApiOperation({
    summary:
      'Send custom subscription ready email to center || This route allows super admin to notify a center that their custom subscription is ready.',
  })
  @ApiBearerAuth()
  @ValidateAdmin()
  @Post('send-subscription-ready')
  sendSubscriptionReadyEmail(@Body() dto: CreateContactDto) {
    return this.contactService.sendCustomSubscriptionReadyEmail(dto);
  }

  // ------------------  Delete all contact messages ----------------------
  @ApiOperation({
    summary:
      'Delete all contact messages By super admin || This route allows users to delete all contact messages that they have submitted.',
  })
  @ApiBearerAuth()
  @ValidateAdmin()
  @Delete('messages/:id')
  deleteContactMessage(@Query('id') id: string) {
    return this.contactService.deleteContactMessage(id);
  }
  // ------------------------- delete subscription offer ----------------------
  @ApiOperation({
    summary:
      'Delete a custom offer subscription By super admin || This route allows users to delete a custom offer subscription that they have subscribed to.',
  })
  @ApiBearerAuth()
  @ValidateAdmin()
  @Delete('subscriptions/:id')
  deleteSubscription(@Query('id') id: string) {
    return this.contactService.deleteCustomOfferSubscription(id);
  }
}
