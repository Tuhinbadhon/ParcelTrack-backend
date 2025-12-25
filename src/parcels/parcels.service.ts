import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Parcel,
  ParcelDocument,
  ParcelStatus,
  PaymentStatus,
  PaymentType,
} from "./schemas/parcel.schema";
import {
  CreateParcelDto,
  UpdateParcelStatusDto,
  AssignAgentDto,
  UpdateLocationDto,
} from "./dto/parcel.dto";
import { EventsGateway } from "../gateway/events.gateway";

@Injectable()
export class ParcelsService {
  constructor(
    @InjectModel(Parcel.name) private parcelModel: Model<ParcelDocument>,
    private eventsGateway: EventsGateway
  ) {}

  private generateTrackingNumber(): string {
    const prefix = "PCL";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  async create(
    createParcelDto: CreateParcelDto,
    senderId: string
  ): Promise<Parcel> {
    const trackingNumber = this.generateTrackingNumber();
    const paymentStatus =
      createParcelDto.paymentType === PaymentType.COD
        ? PaymentStatus.DUE
        : PaymentStatus.PAID;
    const createdParcel = new this.parcelModel({
      ...createParcelDto,
      senderId,
      trackingNumber,
      paymentStatus,
      statusHistory: [
        {
          status: ParcelStatus.PENDING,
          timestamp: new Date(),
          note: "Parcel created",
        },
      ],
    });
    const parcel = await createdParcel.save();
    const populatedParcel = await parcel.populate([
      "senderId",
      "senderName",
      "agentId",
    ]);

    // Emit socket event - notify admins of new booking
    this.eventsGateway.emitParcelCreated(populatedParcel);

    // Send notification to customer
    this.eventsGateway.emitNotification(
      senderId,
      `Your parcel has been booked successfully! Tracking number: ${trackingNumber}`,
      "success",
      populatedParcel._id.toString()
    );

    // Notify admins
    this.eventsGateway.emitNotificationToRole(
      "admin",
      `New parcel booking from ${populatedParcel.senderName} - ${trackingNumber}`,
      "info"
    );

    return populatedParcel;
  }

  async findAll(filters?: any): Promise<Parcel[]> {
    const query = filters || {};
    return this.parcelModel
      .find(query)
      .populate("senderId", "name email phone")
      .populate("agentId", "name email phone")
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Parcel> {
    const parcel = await this.parcelModel
      .findById(id)
      .populate("senderId", "name email phone")
      .populate("agentId", "name email phone")
      .exec();

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    return parcel;
  }

  async findByTracking(trackingNumber: string): Promise<Parcel> {
    const parcel = await this.parcelModel
      .findOne({ trackingNumber })
      .populate("senderId", "name email phone")
      .populate("agentId", "name email phone")
      .exec();

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    return parcel;
  }

  async findBySender(senderId: string): Promise<Parcel[]> {
    return this.parcelModel
      .find({ senderId })
      .populate("agentId", "name email phone")
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByAgent(agentId: string): Promise<Parcel[]> {
    return this.parcelModel
      .find({ agentId })
      .populate("senderId", "name email phone")
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateParcelStatusDto
  ): Promise<Parcel> {
    const parcel = await this.parcelModel.findById(id);

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    parcel.status = updateStatusDto.status;

    // Auto-mark payment as paid when delivered (for COD)
    if (updateStatusDto.status === ParcelStatus.DELIVERED) {
      if (
        parcel.paymentType === PaymentType.COD &&
        parcel.paymentStatus !== PaymentStatus.PAID
      ) {
        parcel.paymentStatus = PaymentStatus.PAID;
        // Emit COD payment received notification
        const populatedForPayment = await parcel.populate([
          "senderId",
          "agentId",
        ]);
        this.eventsGateway.emitPaymentReceived(
          populatedForPayment,
          parcel.cost
        );
      }
    }

    parcel.statusHistory.push({
      status: updateStatusDto.status,
      timestamp: new Date(),
      location: updateStatusDto.location,
      note: updateStatusDto.note,
    });

    const updatedParcel = await parcel.save();
    const populatedParcel = await updatedParcel.populate([
      "senderId",
      "agentId",
    ]);

    // Emit socket event for status update
    this.eventsGateway.emitParcelStatusUpdated(populatedParcel);

    // Send notifications based on status
    const senderId =
      (populatedParcel.senderId as any)?._id?.toString() ||
      populatedParcel.senderId?.toString();
    const agentId =
      (populatedParcel.agentId as any)?._id?.toString() ||
      populatedParcel.agentId?.toString();

    let statusMessage = "";
    switch (updateStatusDto.status) {
      case ParcelStatus.PICKED_UP:
        statusMessage = `Your parcel ${populatedParcel.trackingNumber} has been picked up and is on its way!`;
        break;
      case ParcelStatus.IN_TRANSIT:
        statusMessage = `Your parcel ${populatedParcel.trackingNumber} is in transit`;
        break;
      case ParcelStatus.OUT_FOR_DELIVERY:
        statusMessage = `Your parcel ${populatedParcel.trackingNumber} is out for delivery today!`;
        break;
      case ParcelStatus.DELIVERED:
        statusMessage = `Your parcel ${populatedParcel.trackingNumber} has been delivered successfully!`;
        break;
      case ParcelStatus.FAILED:
        statusMessage = `Delivery attempt failed for parcel ${populatedParcel.trackingNumber}. We'll try again.`;
        break;
      case ParcelStatus.RETURNED:
        statusMessage = `Parcel ${populatedParcel.trackingNumber} has been returned`;
        break;
    }

    if (statusMessage && senderId) {
      this.eventsGateway.emitNotification(
        senderId,
        statusMessage,
        updateStatusDto.status === ParcelStatus.DELIVERED ? "success" : "info"
      );
    }

    // Notify agent of status change if assigned
    if (agentId && updateStatusDto.status === ParcelStatus.DELIVERED) {
      this.eventsGateway.emitNotification(
        agentId,
        `Parcel ${populatedParcel.trackingNumber} marked as delivered`,
        "success"
      );
    }

    return populatedParcel;
  }

  async assignAgent(
    id: string,
    assignAgentDto: AssignAgentDto
  ): Promise<Parcel> {
    const parcel = await this.parcelModel
      .findByIdAndUpdate(id, { agentId: assignAgentDto.agentId }, { new: true })
      .populate(["senderId", "agentId"]);

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    // Emit socket event - notify agent and admin
    // this.eventsGateway.emitParcelAssigned(parcel, assignAgentDto.agentId);

    // Send notification to agent
    this.eventsGateway.emitNotification(
      assignAgentDto.agentId,
      `New parcel ${parcel.trackingNumber} has been assigned to you`,
      "info"
    );

    // Notify customer that agent is assigned
    const senderId =
      (parcel.senderId as any)?._id?.toString() || parcel.senderId?.toString();
    if (senderId) {
      this.eventsGateway.emitNotification(
        senderId,
        `An agent has been assigned to your parcel ${parcel.trackingNumber}`,
        "info"
      );
    }

    return parcel;
  }

  async updateLocation(
    id: string,
    updateLocationDto: UpdateLocationDto
  ): Promise<Parcel> {
    const parcel = await this.parcelModel
      .findByIdAndUpdate(
        id,
        {
          currentLocation: {
            lat: updateLocationDto.lat,
            lng: updateLocationDto.lng,
          },
        },
        { new: true }
      )
      .populate(["senderId", "agentId"]);

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    // Emit socket event - notify customer tracking the parcel
    this.eventsGateway.emitParcelLocationUpdated(parcel);

    // Send notification to customer
    const senderId =
      (parcel.senderId as any)?._id?.toString() || parcel.senderId?.toString();
    if (senderId) {
      this.eventsGateway.emitNotification(
        senderId,
        `Location updated for your parcel ${parcel.trackingNumber}`,
        "info"
      );
    }

    return parcel;
  }

  async markUrgent(id: string): Promise<Parcel> {
    const parcel = await this.parcelModel
      .findByIdAndUpdate(id, { priority: "high", urgent: true }, { new: true })
      .populate(["senderId", "agentId"]);

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    // Emit urgent parcel notification
    this.eventsGateway.emitUrgentParcel(parcel);

    // Send notification to agent if assigned
    const agentId =
      (parcel.agentId as any)?._id?.toString() || parcel.agentId?.toString();
    if (agentId) {
      this.eventsGateway.emitNotification(
        agentId,
        `URGENT: Parcel ${parcel.trackingNumber} requires immediate attention!`,
        "warning"
      );
    }

    // Notify admins
    this.eventsGateway.emitNotificationToRole(
      "admin",
      `Parcel ${parcel.trackingNumber} marked as urgent`,
      "warning"
    );

    return parcel;
  }

  async remove(id: string): Promise<Parcel> {
    const parcel = await this.parcelModel.findByIdAndDelete(id);

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    return parcel;
  }

  async getStatistics() {
    const totalParcels = await this.parcelModel.countDocuments();
    const pendingParcels = await this.parcelModel.countDocuments({
      status: ParcelStatus.PENDING,
    });
    const inTransitParcels = await this.parcelModel.countDocuments({
      status: ParcelStatus.IN_TRANSIT,
    });
    const deliveredParcels = await this.parcelModel.countDocuments({
      status: ParcelStatus.DELIVERED,
    });

    // Calculate revenue
    const prepaidRevenue = await this.parcelModel.aggregate([
      {
        $match: {
          paymentType: PaymentType.PREPAID,
          paymentStatus: PaymentStatus.PAID,
        },
      },
      { $group: { _id: null, total: { $sum: "$cost" } } },
    ]);

    const codRevenue = await this.parcelModel.aggregate([
      {
        $match: {
          paymentType: PaymentType.COD,
          paymentStatus: PaymentStatus.PAID,
        },
      },
      { $group: { _id: null, total: { $sum: "$cost" } } },
    ]);

    return {
      total: totalParcels,
      pending: pendingParcels,
      inTransit: inTransitParcels,
      delivered: deliveredParcels,
      revenue: {
        prepaid: prepaidRevenue[0]?.total || 0,
        cod: codRevenue[0]?.total || 0,
        total: (prepaidRevenue[0]?.total || 0) + (codRevenue[0]?.total || 0),
      },
    };
  }
}
