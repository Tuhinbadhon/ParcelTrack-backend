import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { NotificationsService } from "../notifications/notifications.service";
import { Logger, UnauthorizedException } from "@nestjs/common";

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets = new Map<string, string[]>(); // userId -> socketIds[]

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private notificationsService: NotificationsService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: No token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const decoded = this.jwtService.verify(token);
      const user = await this.usersService.findOne(decoded.sub);

      if (!user) {
        this.logger.warn(
          `Client ${client.id} connection rejected: User not found`
        );
        client.disconnect();
        return;
      }

      // Attach user to socket
      const userId = (user as any)._id.toString();
      client.user = {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      // Disconnect ALL old sockets from ALL users tracked by this client
      // This handles logout -> login with different user scenario
      const allUserIds = Array.from(this.userSockets.keys());
      for (const otherUserId of allUserIds) {
        const socketIds = this.userSockets.get(otherUserId) || [];
        for (const socketId of socketIds) {
          if (socketId !== client.id) {
            const oldSocket = this.server.sockets.sockets.get(socketId);
            // Disconnect old socket from same client (same handshake source)
            if (
              oldSocket &&
              oldSocket.handshake.headers["user-agent"] ===
                client.handshake.headers["user-agent"]
            ) {
              this.logger.warn(
                `Disconnecting old session from different user: Socket ${socketId}`
              );
              oldSocket.emit("session:replaced", {
                message: "New session started from this browser",
              });
              // Leave all rooms
              oldSocket.rooms.forEach((room) => oldSocket.leave(room));
              oldSocket.disconnect(true);

              // Remove from tracking
              const sockets = this.userSockets.get(otherUserId) || [];
              const filtered = sockets.filter((id) => id !== socketId);
              if (filtered.length > 0) {
                this.userSockets.set(otherUserId, filtered);
              } else {
                this.userSockets.delete(otherUserId);
              }
            }
          }
        }
      }

      // Track new socket for this user
      this.userSockets.set(userId, [client.id]);

      // Join user-specific room (for targeted notifications)
      client.join(`user:${userId}`);

      // Only join role-based room for admins (for admin broadcasts)
      if (user.role === "admin") {
        client.join("admin");
      }

      this.logger.log(
        `Client connected: ${user.name} (${user.role}) - Socket: ${client.id} - Rooms: ${Array.from(client.rooms).join(", ")}`
      );

      // Send confirmation to client
      client.emit("connection:success", {
        userId: userId,
        name: user.name,
        role: user.role,
      });

      // Send pending notifications
      const pendingNotifications = await this.notificationsService.findByUser(
        userId,
        true // unread only
      );

      if (pendingNotifications.length > 0) {
        this.logger.log(
          `Sending ${pendingNotifications.length} pending notifications to ${user.name}`
        );
        client.emit("notifications:pending", {
          notifications: pendingNotifications,
          count: pendingNotifications.length,
        });
      }

      // Notify admins when agent comes online
      if (user.role === "agent") {
        this.server.to("admin").emit("agent:online-status", {
          agentId: (user as any)._id.toString(),
          agentName: user.name,
          isOnline: true,
        });
      }
    } catch (error) {
      this.logger.error(
        `Authentication error for client ${client.id}:`,
        error.message
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      const userId = client.user.id;

      // Remove from socket tracking
      const sockets = this.userSockets.get(userId) || [];
      const filtered = sockets.filter((id) => id !== client.id);

      if (filtered.length > 0) {
        this.userSockets.set(userId, filtered);
      } else {
        this.userSockets.delete(userId);
      }

      this.logger.log(
        `Client disconnected: ${client.user.name} - Socket: ${client.id}`
      );

      // Notify admins when agent goes offline (only if no other sockets)
      if (client.user.role === "agent" && filtered.length === 0) {
        this.server.to("admin").emit("agent:online-status", {
          agentId: client.user.id,
          agentName: client.user.name,
          isOnline: false,
        });
      }
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  // Client event listeners
  @SubscribeMessage("parcel:update-status")
  handleParcelUpdateStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { parcelId: string; status: string }
  ) {
    this.logger.log(
      `Status update request from ${client.user?.name}: ${data.parcelId} -> ${data.status}`
    );
    // This will be handled by the service, just logging here
  }

  @SubscribeMessage("parcel:update-location")
  handleParcelUpdateLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { parcelId: string; location: { lat: number; lng: number } }
  ) {
    this.logger.log(
      `Location update from ${client.user?.name}: ${data.parcelId}`
    );
    // This will be handled by the service, just logging here
  }

  @SubscribeMessage("agent:status")
  handleAgentStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { isOnline: boolean }
  ) {
    if (client.user?.role === "agent") {
      this.server.to("admin").emit("agent:online-status", {
        agentId: client.user.id,
        agentName: client.user.name,
        isOnline: data.isOnline,
      });
    }
  }

  @SubscribeMessage("customer:inquiry")
  handleCustomerInquiry(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { parcelId: string; message: string }
  ) {
    this.server.to("admin").emit("customer:inquiry", {
      customerId: client.user?.id,
      parcelId: data.parcelId,
      message: data.message,
    });

    this.logger.log(
      `Customer inquiry from ${client.user?.name} about parcel ${data.parcelId}`
    );
  }

  // Emit methods to be called from services

  emitParcelCreated(parcel: any) {
    // Notify admins of new booking
    this.server.to("admin").emit("parcel:new-booking", { parcel });
    this.logger.log(`New parcel booking: ${parcel.trackingNumber}`);
  }

  emitParcelStatusUpdated(parcel: any) {
    const senderId =
      typeof parcel.senderId === "object"
        ? parcel.senderId._id?.toString()
        : parcel.senderId;
    const agentId =
      typeof parcel.agentId === "object"
        ? parcel.agentId._id?.toString()
        : parcel.agentId;

    // Emit to customer
    if (senderId) {
      this.server
        .to(`user:${senderId}`)
        .emit("parcel:status-updated", { parcel });
    }

    // Emit to assigned agent
    if (agentId) {
      this.server
        .to(`user:${agentId}`)
        .emit("parcel:status-updated", { parcel });
    }

    // Emit to admins
    this.server.to("admin").emit("parcel:status-updated", { parcel });

    // Specific status-based notifications
    if (parcel.status === "picked_up") {
      if (senderId) {
        this.server.to(`user:${senderId}`).emit("parcel:picked-up", { parcel });
      }
    } else if (parcel.status === "delivered") {
      if (senderId) {
        this.server.to(`user:${senderId}`).emit("parcel:delivered", { parcel });
      }
      if (agentId) {
        this.server.to(`user:${agentId}`).emit("parcel:delivered", { parcel });
      }
    } else if (parcel.status === "failed") {
      if (senderId) {
        this.server.to(`user:${senderId}`).emit("parcel:failed", {
          parcel,
          reason: "Delivery attempt failed",
        });
      }
      if (agentId) {
        this.server.to(`user:${agentId}`).emit("parcel:failed", {
          parcel,
          reason: "Delivery attempt failed",
        });
      }
    }

    this.logger.log(
      `Parcel status updated: ${parcel.trackingNumber} -> ${parcel.status}`
    );
  }

  emitParcelAssigned(parcel: any, agentId: string) {
    // Notify the assigned agent
    this.server.to(`user:${agentId}`).emit("parcel:assigned", {
      parcel,
      agentId,
    });

    // Notify admin
    this.server.to("admin").emit("parcel:assigned", {
      parcel,
      agentId,
    });

    this.logger.log(
      `Parcel ${parcel.trackingNumber} assigned to agent ${agentId}`
    );
  }

  emitParcelDelivered(parcel: any) {
    const senderId =
      typeof parcel.senderId === "object"
        ? parcel.senderId._id?.toString()
        : parcel.senderId;
    const agentId =
      typeof parcel.agentId === "object"
        ? parcel.agentId._id?.toString()
        : parcel.agentId;

    // Emit to customer
    if (senderId) {
      this.server.to(`user:${senderId}`).emit("parcel:delivered", { parcel });
    }

    // Emit to agent
    if (agentId) {
      this.server.to(`user:${agentId}`).emit("parcel:delivered", { parcel });
    }

    // Emit to admins
    this.server.to("admin").emit("parcel:delivered", { parcel });

    this.logger.log(`Parcel delivered: ${parcel.trackingNumber}`);
  }

  emitParcelLocationUpdated(parcel: any) {
    const senderId =
      typeof parcel.senderId === "object"
        ? parcel.senderId._id?.toString()
        : parcel.senderId;
    const agentId =
      typeof parcel.agentId === "object"
        ? parcel.agentId._id?.toString()
        : parcel.agentId;

    // Emit to customer tracking the parcel
    if (senderId) {
      this.server
        .to(`user:${senderId}`)
        .emit("parcel:location-updated", { parcel });
    }

    // Emit to assigned agent
    if (agentId) {
      this.server
        .to(`user:${agentId}`)
        .emit("parcel:location-updated", { parcel });
    }

    // Emit to admins for tracking
    this.server.to("admin").emit("parcel:location-updated", { parcel });

    this.logger.log(`Location updated for parcel: ${parcel.trackingNumber}`);
  }

  emitPaymentReceived(parcel: any, amount: number) {
    const agentId =
      typeof parcel.agentId === "object"
        ? parcel.agentId._id?.toString()
        : parcel.agentId;

    // Notify admin
    this.server.to("admin").emit("payment:received", { parcel, amount });

    // Notify agent
    if (agentId) {
      this.server
        .to(`user:${agentId}`)
        .emit("payment:received", { parcel, amount });
    }

    this.logger.log(
      `COD payment received: ${parcel.trackingNumber} - $${amount}`
    );
  }

  emitUrgentParcel(parcel: any) {
    const agentId =
      typeof parcel.agentId === "object"
        ? parcel.agentId._id?.toString()
        : parcel.agentId;

    // Notify admin
    this.server.to("admin").emit("parcel:urgent", {
      parcel,
      priority: "high",
    });

    // Notify assigned agent
    if (agentId) {
      this.server.to(`user:${agentId}`).emit("parcel:urgent", {
        parcel,
        priority: "high",
      });
    }

    this.logger.log(`Urgent parcel marked: ${parcel.trackingNumber}`);
  }

  emitRouteUpdated(agentId: string, routeId: string, parcelsCount: number) {
    this.server.to(`user:${agentId}`).emit("route:updated", {
      routeId,
      parcelsCount,
    });

    this.logger.log(
      `Route updated for agent ${agentId}: ${parcelsCount} parcels`
    );
  }

  emitSystemAlert(
    message: string,
    level: "info" | "warning" | "error" = "info"
  ) {
    this.server.to("admin").emit("system:alert", {
      message,
      level,
    });

    this.logger.log(`System alert (${level}): ${message}`);
  }

  async emitNotification(
    userId: string,
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
    parcelId?: string
  ) {
    // Save to database
    await this.notificationsService.create(userId, message, type, parcelId);

    // Send via socket if user is online
    this.server.to(`user:${userId}`).emit("notification:new", {
      message,
      type,
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`Notification sent to user ${userId}: ${message}`);
  }

  emitNotificationToRole(
    role: string,
    message: string,
    type: "info" | "success" | "warning" | "error" = "info"
  ) {
    this.server.to(role).emit("notification:new", {
      message,
      type,
    });
  }

  emitNotificationToAll(
    message: string,
    type: "info" | "success" | "warning" | "error" = "info"
  ) {
    this.server.emit("notification:new", {
      message,
      type,
    });
  }
}
