import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LogsService } from './logs.service';
import { AuthService } from '../auth/auth.service';
import { LogEntry, LogMessage } from '#types/index';

@WebSocketGateway({
  namespace: '/logs',
  cors: {
    origin: '*',
  },
})
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LogsGateway.name);
  private activeStreams: Map<string, () => void> = new Map();

  constructor(
    private logsService: LogsService,
    private authService: AuthService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`Client connecting: ${client.id}`);

    // Extract token from query or auth header
    const token =
      (client.handshake.query.token as string) ||
      client.handshake.auth?.token ||
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`Client ${client.id} - No token provided`);
      client.emit('error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    try {
      this.authService.validateToken(token);
      this.logger.log(`Client authenticated: ${client.id}`);

      const message: LogMessage = { type: 'connected' };
      client.emit('log', message);
    } catch {
      this.logger.warn(`Client ${client.id} - Invalid token`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Stop log stream if active
    const stopStream = this.activeStreams.get(client.id);
    if (stopStream) {
      stopStream();
      this.activeStreams.delete(client.id);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: unknown
  ): Promise<void> {
    this.logger.log(`Client ${client.id} subscribing to logs`);

    // Stop existing stream if any
    const existingStop = this.activeStreams.get(client.id);
    if (existingStop) {
      existingStop();
    }

    try {
      const stopStream = await this.logsService.streamLogs(
        (entry: LogEntry) => {
          const message: LogMessage = { type: 'log', data: entry };
          client.emit('log', message);
        },
        (error: Error) => {
          this.logger.error(`Log stream error for ${client.id}:`, error);
          const message: LogMessage = { type: 'error', error: error.message };
          client.emit('log', message);
        }
      );

      this.activeStreams.set(client.id, stopStream);
    } catch (error) {
      this.logger.error(`Failed to start log stream for ${client.id}:`, error);
      const message: LogMessage = {
        type: 'error',
        error: 'Failed to start log stream',
      };
      client.emit('log', message);
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket): void {
    this.logger.log(`Client ${client.id} unsubscribing from logs`);

    const stopStream = this.activeStreams.get(client.id);
    if (stopStream) {
      stopStream();
      this.activeStreams.delete(client.id);
    }

    const message: LogMessage = { type: 'disconnected' };
    client.emit('log', message);
  }
}
