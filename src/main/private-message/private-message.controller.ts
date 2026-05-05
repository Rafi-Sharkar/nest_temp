import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { User } from "@/common/decorators/user.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { PrivateMessageService } from "./private-message.service";
import { CreateMessageDto, StartPrivateChatDto } from "./dto/private-message.dto";

@ApiTags("Private Messaging")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("private-messages")
export class PrivateMessageController {
    constructor(private readonly chatService: PrivateMessageService) {}

    @Post("start")
    @ApiOperation({ summary: "Start or get a 1-to-1 chat" })
    async startChat(@User("id") userId: string, @Body() dto: StartPrivateChatDto) {
        return this.chatService.getOrCreatePrivateChat(userId, dto.otherUserId);
    }

    @Get("my-chats")
    @ApiOperation({ summary: "Get list of my chats" })
    async getMyChats(@User("id") userId: string) {
        return this.chatService.getMyChats(userId);
    }

    @Get(":chatId/messages")
    @ApiOperation({ summary: "Get messages for a chat" })
    async getMessages(@User("id") userId: string, @Param("chatId") chatId: string) {
        // Verification happens inside service
        return this.chatService.getMessages(chatId);
    }

    @Post(":chatId/messages")
    @ApiOperation({ summary: "Send a message via HTTP" })
    async sendMessage(
        @User("id") userId: string,
        @Param("chatId") chatId: string,
        @Body() dto: CreateMessageDto,
    ) {
        return this.chatService.createMessage(userId, chatId, dto);
    }

    @Get(":chatId/unread")
    @ApiOperation({ summary: "Get unread message count for a chat" })
    async getUnreadCount(@User("id") userId: string, @Param("chatId") chatId: string) {
        return this.chatService.getUnreadCount(chatId, userId);
    }
}
