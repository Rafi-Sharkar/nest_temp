import { UserResponseDto } from '@/common/dto/user-response.dto';
import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { AuthMailService } from '@/lib/mail/services/auth-mail.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { TwilioService } from '@/lib/twilio/twilio.service';
import { AuthUtilsService } from '@/lib/utils/services/auth-utils.service';
import { Injectable } from '@nestjs/common';
import { OtpType, Prisma } from '@prisma';
import {
  ResendOtpDto,
  ResetPhoneOtpDto,
  VerifyOTPDto,
  VerifyPhoneOtpDto,
} from '../dto/otp.dto';

@Injectable()
export class AuthOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: AuthUtilsService,
    private readonly authMailService: AuthMailService,
    private readonly twilioService: TwilioService,
  ) {}

  @HandleError('Failed to resend OTP')
  async resendOtp({ email, type }: ResendOtpDto): Promise<TResponse<any>> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');

    if (user.isVerified && type === OtpType.EMAIL_VERIFICATION) {
      throw new AppError(400, 'User is already verified');
    }

    await this.prisma.client.userOtp.deleteMany({
      where: {
        userId: user.id,
        type,
        expiresAt: { gt: new Date() },
      },
    });

    const otp = await this.utils.generateOTPAndSave(user.id, type);

    try {
      if (type === OtpType.EMAIL_VERIFICATION || type === OtpType.PASSWORD_RESET) {
        await this.authMailService.sendVerificationCodeEmail(
          email,
          otp.toString(),
          {
            subject: 'Your OTP Code',
            message: `Here is your OTP code. It will expire in 5 minutes.`,
          },
        );
      }
    } catch {
      await this.prisma.client.userOtp.deleteMany({
        where: { userId: user.id, type },
      });
      throw new AppError(500, 'Failed to send OTP email. Please try again later.');
    }

    return successResponse(null, `${type} OTP sent successfully`);
  }

  @HandleError('OTP verification failed', 'User')
  async verifyOTP(
    dto: VerifyOTPDto,
    type: OtpType = OtpType.EMAIL_VERIFICATION,
  ): Promise<TResponse<any>> {
    const { email, otp } = dto;

    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');

    const userOtp = await this.prisma.client.userOtp.findFirst({
      where: { userId: user.id, type },
      orderBy: { createdAt: 'desc' },
    });

    if (!userOtp) throw new AppError(400, 'OTP is not set. Please request a new one.');

    if (userOtp.expiresAt < new Date()) {
      await this.prisma.client.userOtp.delete({ where: { id: userOtp.id } });
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    const isCorrectOtp = await this.utils.compare(otp, userOtp.code);
    if (!isCorrectOtp) throw new AppError(400, 'Invalid OTP');

    await this.prisma.client.userOtp.deleteMany({
      where: { userId: user.id, type },
    });

    const updateData: Prisma.UserUpdateInput = {
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
    };
    if (type === OtpType.EMAIL_VERIFICATION) {
      updateData.isVerified = true;
      if (user.status === 'INACTIVE') {
        updateData.status = 'ACTIVE';
      }
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const token = await this.utils.generateTokenPairAndSave({
      email,
      role: updatedUser.role,
      sub: updatedUser.id,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser<UserResponseDto>(updatedUser as any),
        token,
      },
      'OTP verified successfully',
    );
  }

  @HandleError('Phone OTP verification failed', 'User')
  async verifyPhoneOtp(dto: VerifyPhoneOtpDto): Promise<TResponse<any>> {
    const { phoneNumber, otp } = dto;

    const user = await this.prisma.client.user.findUnique({ where: { phoneNumber } });
    if (!user) throw new AppError(404, 'User not found');

    const userOtp = await this.prisma.client.userOtp.findFirst({
      where: { userId: user.id, type: OtpType.PHONE_VERIFICATION },
      orderBy: { createdAt: 'desc' },
    });

    if (!userOtp) throw new AppError(400, 'OTP is not set. Please request a new one.');

    if (userOtp.expiresAt < new Date()) {
      await this.prisma.client.userOtp.delete({ where: { id: userOtp.id } });
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    const isCorrectOtp = await this.utils.compare(otp, userOtp.code);
    if (!isCorrectOtp) throw new AppError(400, 'Invalid OTP');

    await this.prisma.client.userOtp.deleteMany({
      where: { userId: user.id, type: OtpType.PHONE_VERIFICATION },
    });

    const updatedUser = await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        isPhoneVerified: true,
        isVerified: true,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    const token = await this.utils.generateTokenPairAndSave({
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    return successResponse(
      {
        user: await this.utils.sanitizeUser<UserResponseDto>(updatedUser as any),
        token,
      },
      'Phone OTP verified successfully',
    );
  }

  @HandleError('Failed to resend phone OTP')
  async resendPhoneOtp(dto: ResetPhoneOtpDto): Promise<TResponse<any>> {
    const { phoneNumber, type } = dto;

    const user = await this.prisma.client.user.findUnique({ where: { phoneNumber } });
    if (!user) throw new AppError(404, 'User not found');

    if (user.isPhoneVerified && type === OtpType.PHONE_VERIFICATION) {
      throw new AppError(400, 'User phone is already verified');
    }

    await this.prisma.client.userOtp.deleteMany({
      where: {
        userId: user.id,
        type,
        expiresAt: { gt: new Date() },
      },
    });

    const otp = await this.utils.generateOTPAndSave(user.id, type);

    try {
      await this.twilioService.sendOtpSms(phoneNumber, otp);
    } catch {
      await this.prisma.client.userOtp.deleteMany({
        where: { userId: user.id, type },
      });
      throw new AppError(500, 'Failed to send OTP SMS. Please try again later.');
    }

    return successResponse(null, `Phone ${type} OTP sent successfully`);
  }
}
