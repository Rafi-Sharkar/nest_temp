import { JWTPayload } from '@/core/jwt/jwt.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/lib/prisma/prisma.service';

interface PayloadForSocketClient {
  sub: string;
  email: string;
  userUpdates: boolean;
  userRegistration: boolean;
  payment: boolean;
  message: boolean;
}

interface Notification {
  [key: string]: any;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
@Injectable()
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);
  private readonly clients = new Map<string, Set<Socket>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log(
      'Socket.IO server initialized for Notification Gateway',
      server.adapter.name,
    );
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) return client.disconnect(true);

      const payload = this.jwtService.verify<JWTPayload>(token, {
        secret: this.configService.getOrThrow('JWT_SECRET'),
      });

      if (!payload.sub) return client.disconnect(true);

      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
        include: { notificationToggle: true },
      });

      if (!user) return client.disconnect(true);

      //------------  Ensure the user has a NotificationToggle record-------------
      let toggle = user.notificationToggle;
      if (!toggle) {
        // ---------- Create a new toggle record for the user------------
        toggle = await this.prisma.client.notificationToggle.create({
          data: {
            userId: user.id,
            NotificationType: 'userUpdates',
          },
        });
      }

      const payloadForSocketClient: PayloadForSocketClient = {
        sub: user.id,
        email: user.email,
        userUpdates: toggle.userUpdates,
        userRegistration: toggle.userRegistration,
        payment: toggle.payment,
        message: toggle.message,
      };

      client.data.user = payloadForSocketClient;
      this.subscribeClient(user.id, client);

      this.logger.log(`Client connected: ${user.id}`);
    } catch (err: any) {
      this.logger.warn(`JWT verification failed: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub;
    if (userId) {
      this.unsubscribeClient(userId, client);
      this.logger.log(`Client disconnected: ${userId}`);
    } else {
      this.logger.log('Client disconnected: unknown user');
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    const headerToken = client.handshake.headers.authorization;
    const authToken = client.handshake.auth?.token;
    const queryAuthorization = client.handshake.query?.authorization;
    const queryToken = client.handshake.query?.token;

    const rawToken =
      (typeof headerToken === 'string' && headerToken) ||
      (typeof authToken === 'string' && authToken) ||
      (typeof queryAuthorization === 'string' && queryAuthorization) ||
      (typeof queryToken === 'string' && queryToken) ||
      null;

    if (!rawToken) return null;

    return rawToken.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length)
      : rawToken;
  }

  private subscribeClient(userId: string, client: Socket) {
    if (!this.clients.has(userId)) this.clients.set(userId, new Set());
    this.clients.get(userId)!.add(client);
    this.logger.debug(`Subscribed client to user ${userId}`);
  }

  private unsubscribeClient(userId: string, client: Socket) {
    const set = this.clients.get(userId);
    if (!set) return;

    set.delete(client);
    this.logger.debug(`Unsubscribed client from user ${userId}`);
    if (set.size === 0) this.clients.delete(userId);
  }

  public getClientsForUser(userId: string): Set<Socket> {
    return this.clients.get(userId) || new Set();
  }

  public async notifySingleUser(
    userId: string,
    event: string,
    data: Notification,
  ) {
    const clients = this.getClientsForUser(userId);
    if (clients.size === 0) return;
    clients.forEach((client) => client.emit(event, data));
  }

  public async notifyMultipleUsers(
    userIds: string[],
    event: string,
    data: Notification,
  ) {
    userIds.forEach((userId) => this.notifySingleUser(userId, event, data));
  }

  public async notifyAllUsers(event: string, data: Notification) {
    this.clients.forEach((clients) =>
      clients.forEach((client) => client.emit(event, data)),
    );
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong');
  }
}
