import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Notification,
  NotificationDocument,
} from "./schemas/notification.schema";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>
  ) {}

  async create(
    userId: string,
    message: string,
    type: string = "info",
    parcelId?: string,
    metadata?: Record<string, any>
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      userId,
      message,
      type,
      parcelId,
      metadata,
      read: false,
    });
    return notification.save();
  }

  async findByUser(
    userId: string,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    const query: any = { userId };
    if (unreadOnly) {
      query.read = false;
    }
    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    return this.notificationModel
      .findByIdAndUpdate(notificationId, { read: true }, { new: true })
      .exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ userId, read: false }, { read: true })
      .exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId, read: false })
      .exec();
  }

  async delete(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndDelete(notificationId).exec();
  }
}
