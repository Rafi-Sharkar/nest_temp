import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DevToolService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.client.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        isVerified: true,
        status: true,
      },
    });
  }

  async deleteUserById(userId: string) {
    return this.prisma.client.user.delete({
      where: {
        id: userId,
      },
    });
  }
}
