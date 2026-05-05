/*
  Warnings:

  - You are about to drop the `private_conversations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `private_message_statuses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `private_messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CALLING', 'RINING', 'ACTIVE', 'END', 'MISSED', 'DECLINED');

-- DropForeignKey
ALTER TABLE "private_conversations" DROP CONSTRAINT "private_conversations_initiatorId_fkey";

-- DropForeignKey
ALTER TABLE "private_conversations" DROP CONSTRAINT "private_conversations_lastMessageId_fkey";

-- DropForeignKey
ALTER TABLE "private_conversations" DROP CONSTRAINT "private_conversations_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "private_message_statuses" DROP CONSTRAINT "private_message_statuses_messageId_fkey";

-- DropForeignKey
ALTER TABLE "private_message_statuses" DROP CONSTRAINT "private_message_statuses_userId_fkey";

-- DropForeignKey
ALTER TABLE "private_messages" DROP CONSTRAINT "private_messages_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "private_messages" DROP CONSTRAINT "private_messages_fileId_fkey";

-- DropForeignKey
ALTER TABLE "private_messages" DROP CONSTRAINT "private_messages_senderId_fkey";

-- DropTable
DROP TABLE "private_conversations";

-- DropTable
DROP TABLE "private_message_statuses";

-- DropTable
DROP TABLE "private_messages";

-- DropEnum
DROP TYPE "ConversationStatus";

-- DropEnum
DROP TYPE "MessageDeliveryStatus";

-- DropEnum
DROP TYPE "MessageType";

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'CALLING',
    "title" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "socketId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "hasVideo" BOOLEAN NOT NULL DEFAULT false,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_hostUserId_idx" ON "calls"("hostUserId");

-- CreateIndex
CREATE INDEX "calls_recipientUserId_idx" ON "calls"("recipientUserId");

-- CreateIndex
CREATE INDEX "call_participants_callId_idx" ON "call_participants"("callId");

-- CreateIndex
CREATE INDEX "call_participants_socketId_idx" ON "call_participants"("socketId");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
