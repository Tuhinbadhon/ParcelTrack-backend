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

    // Emit socket event
    this.eventsGateway.emitParcelCreated(parcel);

    return parcel;
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
    if (updateStatusDto.status === ParcelStatus.DELIVERED) {
      parcel.paymentStatus = PaymentStatus.PAID;
    }
    parcel.statusHistory.push({
      status: updateStatusDto.status,
      timestamp: new Date(),
      location: updateStatusDto.location,
      note: updateStatusDto.note,
    });

    const updatedParcel = await parcel.save();

    // Emit socket event
    this.eventsGateway.emitParcelStatusUpdated(updatedParcel);

    return updatedParcel.populate(["senderId", "agentId"]);
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

    // Emit socket event
    this.eventsGateway.emitParcelAssigned(parcel);

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

    // Emit socket event
    this.eventsGateway.emitParcelLocationUpdated(parcel);

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

    return {
      total: totalParcels,
      pending: pendingParcels,
      inTransit: inTransitParcels,
      delivered: deliveredParcels,
    };
  }
}
