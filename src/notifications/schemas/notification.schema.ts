import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  INFO = "info",
  SUCCESS = "success",
  WARNING = "warning",
  ERROR = "error",
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({
    required: true,
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType;

  @Prop({ default: false })
  read: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Parcel" })
  parcelId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
