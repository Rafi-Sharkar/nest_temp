import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/lib/prisma/prisma.service";
import { HandleError } from "@/core/error/handle-error.decorator";
import { LiveChat } from "@prisma";
import { CreateMessageDto } from "./dto/private-message.dto";

@Injectable()
export class PrivateMessageService {
    constructor(private prisma: PrismaService) {}

    private get client() {
        return this.prisma.client;
    }

    /** Find or create 1-to-1 chat */
    @HandleError("Failed to get or create chat", "chat")
    async getOrCreatePrivateChat(userA: string, userB: string): Promise<LiveChat> {
        const existing = await this.client.liveChat.findFirst({
            where: {
                type: "INDIVIDUAL",
                participants: {
                    every: {
                        userId: { in: [userA, userB] },
                    },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                profilePhoto: true,
                            },
                        },
                    },
                },
            },
        });

        // Verify it's actually a 1-to-1 between these exact users
        if (existing) {
            const participantIds = existing.participants.map((p) => p.userId).sort();
            const expectedIds = [userA, userB].sort();

            if (JSON.stringify(participantIds) === JSON.stringify(expectedIds)) {
                return existing as unknown as LiveChat;
            }
        }

        return this.client.$transaction(async (tx) => {
            const chat = await tx.liveChat.create({
                data: {
                    type: "INDIVIDUAL",
                    createdById: userA,
                },
            });

            const participants =
                userA === userB
                    ? [{ chatId: chat.id, userId: userA }]
                    : [
                          { chatId: chat.id, userId: userA },
                          { chatId: chat.id, userId: userB },
                      ];

            await tx.liveChatParticipant.createMany({ data: participants });

            const result = await tx.liveChat.findUnique({
                where: { id: chat.id },
                include: {
                    participants: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    name: true,
                                    profilePhoto: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!result) {
                throw new Error("Failed to create chat");
            }

            return result;
        }) as unknown as LiveChat;
    }

    /** Get chat by ID with verification */
    @HandleError("Failed to get chat", "chat")
    async getChatById(chatId: string, userId: string) {
        const chat = await this.client.liveChat.findUnique({
            where: { id: chatId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                profilePhoto: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                profilePhoto: true,
                            },
                        },
                    },
                },
            },
        });

        if (!chat) {
            throw new NotFoundException("Chat not found");
        }

        // Verify user is a participant
        const isParticipant = chat.participants.some((p) => p.userId === userId);
        if (!isParticipant) {
            throw new ForbiddenException("You are not a participant in this chat");
        }

        return chat;
    }

    /**------------- Send message---------------------------- */
    @HandleError("Failed to send message", "message")
    async createMessage(senderId: string, chatId: string, dto: CreateMessageDto) {
        // Verify sender is participant
        const chat = await this.client.liveChat.findUnique({
            where: { id: chatId },
            include: { participants: true },
        });

        if (!chat) {
            throw new NotFoundException("Chat not found");
        }

        const isParticipant = chat.participants.some((p) => p.userId === senderId);
        if (!isParticipant) {
            throw new ForbiddenException("You are not a participant in this chat");
        }

        return this.client.liveMessage.create({
            data: {
                chatId,
                senderId,
                content: dto.content,
                mediaUrl: dto.mediaUrl,
                mediaType: dto.mediaType,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        isVerified: true,
                        name: true,
                        profilePhoto: true,
                    },
                },
                chat: {
                    include: {
                        participants: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        role: true,
                                        isVerified: true,
                                        name: true,
                                        profilePhoto: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    /** ----------Mark message as read------------------ */
    @HandleError("Failed to mark message as read", "message")
    async markRead(messageId: string, userId: string) {
        const message = await this.client.liveMessage.findUnique({
            where: { id: messageId },
            include: { chat: { include: { participants: true } } },
        });

        if (!message) {
            throw new NotFoundException("Message not found");
        }

        // Verify user is participant
        const isParticipant = message.chat.participants.some((p) => p.userId === userId);
        if (!isParticipant) {
            throw new ForbiddenException("You are not a participant in this chat");
        }

        return this.client.liveMessageRead.upsert({
            where: { messageId_userId: { messageId, userId } },
            create: {
                messageId,
                userId,
                liveChatId: message.chatId,
            },
            update: { readAt: new Date() },
        });
    }

    /** List my private chats with last message & unread count */
    @HandleError("Failed to get my chats", "chat")
    async getMyChats(userId: string) {
        const chats = await this.client.liveChat.findMany({
            where: {
                type: "INDIVIDUAL",
                participants: { some: { userId } },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                profilePhoto: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                profilePhoto: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return Promise.all(
            chats.map(async (chat) => {
                const unreadCount = await this.client.liveMessage.count({
                    where: {
                        chatId: chat.id,
                        senderId: { not: userId },
                        readBy: { none: { userId } },
                    },
                });

                // Find the other user in the chat
                const otherUser = chat.participants.find((p) => p.userId !== userId)?.user || null;

                return {
                    ...chat,
                    unreadCount,
                    otherUser,
                    lastMessage: chat.messages[0] || null,
                };
            }),
        );
    }

    /** Get paginated messages for a chat */
    @HandleError("Failed to get messages", "chat")
    async getMessages(chatId: string) {
        const messages = await this.client.liveMessage.findMany({
            where: { chatId },
            orderBy: { createdAt: "desc" },

            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        profilePhoto: true,
                    },
                },
                readBy: {
                    select: {
                        userId: true,
                        readAt: true,
                    },
                },
            },
        });
        return {
            messages,
        };
    }

    /** Get unread message count for a specific chat */
    @HandleError("Failed to get unread message count", "chat")
    async getUnreadCount(chatId: string, userId: string) {
        const count = await this.client.liveMessage.count({
            where: {
                chatId,
                senderId: { not: userId },
                readBy: { none: { userId } },
            },
        });

        return { chatId, unreadCount: count };
    }
}
