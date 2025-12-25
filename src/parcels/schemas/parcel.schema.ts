import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type ParcelDocument = Parcel & Document;

export enum ParcelStatus {
  PENDING = "pending",
  PICKED_UP = "picked_up",
  IN_TRANSIT = "in_transit",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
  FAILED = "failed",
  RETURNED = "returned",
}

export enum PaymentType {
  COD = "cod",
  PREPAID = "prepaid",
}

export enum PaymentStatus {
  DUE = "due",
  PAID = "paid",
}

@Schema({ timestamps: true })
export class Parcel {
  @Prop({ required: true, unique: true })
  trackingNumber: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  senderId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  senderName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User" })
  agentId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  recipientName: string;

  @Prop({ required: true })
  recipientPhone: string;

  @Prop({ required: true })
  recipientAddress: string;

  @Prop()
  recipientMapLink?: string;

  @Prop({ required: true })
  pickupAddress: string;

  @Prop()
  pickupMapLink?: string;

  @Prop({ required: true })
  weight: number;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ParcelStatus, default: ParcelStatus.PENDING })
  status: ParcelStatus;

  @Prop({
    type: [{ status: String, timestamp: Date, location: String, note: String }],
    default: [],
  })
  statusHistory: Array<{
    status: ParcelStatus;
    timestamp: Date;
    location?: string;
    note?: string;
  }>;

  @Prop()
  estimatedDelivery?: Date;

  @Prop({ required: true, enum: PaymentType })
  paymentType: PaymentType;

  @Prop({ required: true, enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @Prop({ required: true })
  cost: number;

  @Prop({ type: { lat: Number, lng: Number } })
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

export const ParcelSchema = SchemaFactory.createForClass(Parcel);
