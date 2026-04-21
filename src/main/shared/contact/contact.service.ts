import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService } from 'src/lib/mail/mail.service';
import { PrismaService } from 'src/lib/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { ContactEmailTemplate } from '@/lib/mail/templates/contact.template';
import { SubscriptionEmailTemplate } from '@/lib/mail/templates/subscription.template';
import { ENVEnum } from 'src/common/enum/env.enum';
import {
  CreateContactDto,
  SubscribeToCustomOffersDto,
} from './dto/create-contact.dto';
import {
  ContactMessageFilterPaginationDto,
  CustomOfferSubscriptionFilterPaginationDto,
} from './dto/filter-pagination.dto';
import { UserEnum } from '@/common/enum/user.enum';
import { EVENT_TYPES } from '@/main/notifications/socket-notification/interface/event.name';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly supportSubject = 'New Contact Form Submission';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @HandleError('Failed to create contact message', 'Contact')
  async create(payload: CreateContactDto): Promise<TResponse<any>> {
    const contact = await this.prisma.client.contact.create({
      data: {
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
      },
    });

    const adminEmail = this.configService.get<string>(ENVEnum.MAIL_USER);

    if (!adminEmail) {
      this.logger.error('MAIL_USER not configured in environment');
      throw new AppError(400, 'Admin email not configured');
    }

    // ----- Admin Notification Email -----
    await this.mailService.sendMail({
      to: adminEmail,
      subject: this.supportSubject,
      html: ContactEmailTemplate.contactAdmin(payload),
      text: this.buildAdminContactText(payload),
    });

    // ----- User Confirmation Email -----
    await this.mailService.sendMail({
      to: payload.email,
      subject: 'We Received Your Message',
      html: ContactEmailTemplate.contactUser(payload),
      text: this.buildUserContactText(payload),
    });

    const recipients = await this.getSuperAdminRecipients();
    if (recipients.length > 0) {
      this.eventEmitter.emit(EVENT_TYPES.CONTACT_CREATE, {
        action: 'CREATE',
        meta: {
          action: 'created',
          info: {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            createdAt: contact.createdAt,
            recipients,
          },
          meta: {
            subject: contact.subject,
          },
        },
      });
    }

    return successResponse(contact, 'Contact message created successfully');
  }

  private async getSuperAdminRecipients(): Promise<
    Array<{
      id: string;
      email: string;
    }>
  > {
    const superAdmins = await this.prisma.client.user.findMany({
      where: {
        role: UserEnum.ADMIN,
      },
      select: {
        id: true,
        email: true,
      },
    });

    return superAdmins.map((admin) => ({
      id: admin.id,
      email: admin.email,
    }));
  }

  private buildAdminContactText(payload: CreateContactDto): string {
    return [
      'New contact form submission',
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Subject: ${payload.subject || 'General Inquiry'}`,
      `Message: ${payload.message}`,
    ].join('\n');
  }

  private buildUserContactText(payload: CreateContactDto): string {
    return [
      `Hello ${payload.name},`,
      'We received your message and our support team will respond shortly.',
      `Subject: ${payload.subject || 'General Inquiry'}`,
      `Message: ${payload.message}`,
    ].join('\n');
  }

  // ---------------------- customer subscription offer ----------------------
  @HandleError('Failed to subscribe to custom offers', 'Contact')
  async subscribeToCustomOffers(
    payload: SubscribeToCustomOffersDto,
    userId: string,
  ): Promise<TResponse<any>> {
    // ------------------- Fetch User Details -----------------
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) {
      this.logger.error('User not found');
      throw new AppError(404, 'User not found');
    }

    // ------------------- Create a new subscription in the database -----------------
    const subscription =
      await this.prisma.client.customOfferSubscription.create({
        data: {
          userId,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          customPrice: payload.customPrice,
          message: payload.message,
          feature: payload.features,
        },
      });

    // ------------------- Get the super admin email from the configuration -----------------
    const adminEmail = this.configService.get<string>(ENVEnum.MAIL_USER);

    if (!adminEmail) {
      this.logger.error('MAIL_USER not configured in environment');
      throw new AppError(400, 'Admin email not configured');
    }

    // ----- Admin Notification Email for Subscription -----
    await this.mailService.sendMail({
      to: adminEmail,
      subject: 'New Custom Offer Subscription',
      html: SubscriptionEmailTemplate.subscriptionAdmin(payload),
      text: this.buildSubscriptionEmailText(payload),
    });

    // ----- User Confirmation Email -----
    await this.mailService.sendMail({
      to: user.email!,
      subject: 'Subscription to Custom Offers Successful',
      html: SubscriptionEmailTemplate.subscriptionConfirmation(payload),
      text: this.buildUserConfirmationEmailText(payload),
    });

    const recipients = await this.getSuperAdminRecipients();
    if (recipients.length > 0) {
      this.eventEmitter.emit(EVENT_TYPES.CONTACT_SUBSCRIBE_CREATE, {
        action: 'CREATE',
        meta: {
          action: 'created',
          info: {
            id: subscription.id,
            name: subscription.name ?? undefined,
            email: subscription.email ?? undefined,
            createdAt: subscription.createdAt,
            recipients,
          },
          meta: {
            customPrice: subscription.customPrice,
            feature: subscription.feature,
          },
        },
      });
    }

    return successResponse(
      subscription,
      'Successfully subscribed to custom offers',
    );
  }

  private buildUserConfirmationEmailText(
    payload: SubscribeToCustomOffersDto,
  ): string {
    return [
      `Hello,`,
      `You have successfully subscribed to our custom offers.`,
      `Custom Price: ${payload.customPrice}`,
      `Message: ${payload.message}`,
      `Features: ${payload.features.join(', ')}`,
    ].join('\n');
  }

  private buildSubscriptionEmailText(
    payload: SubscribeToCustomOffersDto,
  ): string {
    return [
      'New custom offer subscription',
      `Custom Price: ${payload.customPrice}`,
      `Message: ${payload.message}`,
      `Features: ${payload.features.join(', ')}`,
    ].join('\n');
  }

  // ---------------------- Send subscription ready email to center ----------------------
  @HandleError('Failed to send subscription ready email', 'Contact')
  async sendCustomSubscriptionReadyEmail(
    payload: CreateContactDto,
  ): Promise<TResponse<any>> {
    // ------------------- Validate Email Address -----------------
    if (!payload.email) {
      throw new AppError(400, 'Email address is required');
    }

    // ------------------- Get Frontend URL from configuration -----------------
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '';

    // ------------------- Create a notification record in the database -----------------
    const notification = await this.prisma.client.contact.create({
      data: {
        name: payload.name,
        email: payload.email,
        subject: payload.subject || 'Your Custom Subscription is Ready',
        message: payload.message,
      },
    });

    // ----- Send Email to Center/Customer -----
    await this.mailService.sendMail({
      to: payload.email,
      subject: 'Your Custom Subscription is Ready',
      html: SubscriptionEmailTemplate.subscriptionReady(payload, frontendUrl),
      text: this.buildSubscriptionReadyEmailText(payload),
    });

    return successResponse(
      notification,
      'Subscription ready notification sent successfully',
    );
  }

  private buildSubscriptionReadyEmailText(payload: CreateContactDto): string {
    return [
      `Hello ${payload.name},`,
      'We are pleased to inform you that your custom subscription is now ready!',
      `Subject: ${payload.subject || 'Your Custom Subscription'}`,
      `Details: ${payload.message}`,
      'You can now proceed to make your subscription.',
      'If you have any questions, please feel free to contact us.',
    ].join('\n');
  }

  // ----------------------  get all custom offers  ----------------------
  @HandleError('Failed to retrieve custom offer subscriptions', 'Contact')
  async getAllCustomOfferSubscriptions(
    query: CustomOfferSubscriptionFilterPaginationDto,
  ): Promise<TPaginatedResponse<any>> {
    const {
      page = 1,
      limit = 10,
      search,

      fromDate,
      toDate,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search?.trim()) {
      const keyword = search.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
        { message: { contains: keyword, mode: 'insensitive' } },
        { customPrice: { contains: keyword, mode: 'insensitive' } },
        { feature: { has: keyword } },
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    const [subscriptions, total] = await this.prisma.client.$transaction([
      this.prisma.client.customOfferSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.customOfferSubscription.count({ where }),
    ]);

    return successPaginatedResponse(
      subscriptions,
      { page, limit, total },
      'Custom offer subscriptions retrieved successfully',
    );
  }

  //------------------------ get all contract offers ----------------------
  @HandleError('Failed to retrieve contact messages', 'Contact')
  async getAllContactMessages(
    query: ContactMessageFilterPaginationDto,
  ): Promise<TPaginatedResponse<any>> {
    const {
      page = 1,
      limit = 10,
      search,

      fromDate,
      toDate,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search?.trim()) {
      const keyword = search.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
        { subject: { contains: keyword, mode: 'insensitive' } },
        { message: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    const [messages, total] = await this.prisma.client.$transaction([
      this.prisma.client.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.contact.count({ where }),
    ]);

    return successPaginatedResponse(
      messages,
      { page, limit, total },
      'Contact messages retrieved successfully',
    );
  }
  // --------------------- deleteContactMessage-------------------------
  @HandleError('Failed to delete contact message', 'Contact')
  async deleteContactMessage(id: string): Promise<TResponse<any>> {
    await this.prisma.client.contact.delete({ where: { id } });
    return successResponse('Contact message deleted successfully');
  }
  // ---------------------- get custom offer subscription by id ----------------------
  @HandleError('Failed to retrieve custom offer subscription', 'Contact')
  async getCustomOfferSubscriptionById(id: string): Promise<TResponse<any>> {
    const subscription =
      await this.prisma.client.customOfferSubscription.findUnique({
        where: { id },
      });

    if (!subscription) {
      throw new AppError(404, 'Custom offer subscription not found');
    }

    return successResponse(
      subscription,
      'Custom offer subscription retrieved successfully',
    );
  }

  //----------------------  deleteCustomOfferSubscription --------------------------
  @HandleError('Failed to delete custom offer subscription', 'Contact')
  async deleteCustomOfferSubscription(id: string): Promise<TResponse<any>> {
    await this.prisma.client.customOfferSubscription.delete({
      where: { id },
    });
    return successResponse('Custom offer subscription deleted successfully');
  }
}
