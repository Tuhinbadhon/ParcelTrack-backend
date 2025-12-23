import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, room: string) {
    client.join(room);
    console.log(`Client ${client.id} joined room: ${room}`);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, room: string) {
    client.leave(room);
    console.log(`Client ${client.id} left room: ${room}`);
  }

  emitParcelCreated(parcel: any) {
    this.server.emit('parcel:created', parcel);
  }

  emitParcelStatusUpdated(parcel: any) {
    this.server.emit('parcel:status-updated', parcel);
    // Emit to sender's room
    this.server.to(`user:${parcel.senderId}`).emit('parcel:status-updated', parcel);
    // Emit to agent's room if assigned
    if (parcel.agentId) {
      this.server.to(`user:${parcel.agentId}`).emit('parcel:status-updated', parcel);
    }
  }

  emitParcelAssigned(parcel: any) {
    this.server.emit('parcel:assigned', parcel);
    // Notify the assigned agent
    if (parcel.agentId) {
      this.server.to(`user:${parcel.agentId}`).emit('parcel:assigned', parcel);
    }
  }

  emitParcelDelivered(parcel: any) {
    this.server.emit('parcel:delivered', parcel);
    // Notify the sender
    this.server.to(`user:${parcel.senderId}`).emit('parcel:delivered', parcel);
  }

  emitParcelLocationUpdated(parcel: any) {
    this.server.emit('parcel:location-updated', parcel);
    // Notify the sender
    this.server.to(`user:${parcel.senderId}`).emit('parcel:location-updated', parcel);
  }

  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
