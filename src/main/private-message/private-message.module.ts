import { Module } from "@nestjs/common";
import { PrismaService } from "@/lib/prisma/prisma.service";
import { AuthModule } from "@/main/auth/auth.module";
import { PrivateMessageController } from "./private-message.controller";
import { PrivateMessageService } from "./private-message.service";
import { PrivateMessageGateway } from "./private-message.gateway";
import { ActiveUsersService } from "./active-user.service";
import { SocketAuthMiddleware } from "@/common/jwt/socket-auth.middleware";
import { RedisService } from "@/lib/redis/redis.service";

@Module({
    imports: [AuthModule],
    controllers: [PrivateMessageController],
    providers: [
        PrivateMessageService,
        PrivateMessageGateway,
        ActiveUsersService,
        PrismaService,
        SocketAuthMiddleware,
        RedisService,
    ],
    exports: [PrivateMessageService, ActiveUsersService],
})
export class PrivateMessageModule {}
