import { Injectable, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { User, UserDocument } from "./schemas/user.schema";
import {
  Parcel,
  ParcelDocument,
  ParcelStatus,
} from "../parcels/schemas/parcel.schema";

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Parcel.name) private parcelModel: Model<ParcelDocument>
  ) {}

  async create(createUserDto: Partial<User>): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });

    try {
      return await createdUser.save();
    } catch (error) {
      // Mongo duplicate key
      if (error?.code === 11000) {
        const fields = Object.keys(error.keyValue || {}).join(", ");
        throw new ConflictException(`${fields || "Resource"} already exists`);
      }
      throw error; // rethrow other errors to let Nest handle them
    }
  }

  async update(id: string, updateUserDto: Partial<User>): Promise<User> {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    try {
      return await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .select("-password")
        .exec();
    } catch (error) {
      // Mongo duplicate key (email or phone already exists)
      if (error?.code === 11000) {
        const fields = Object.keys(error.keyValue || {}).join(", ");
        throw new ConflictException(`${fields || "Resource"} already exists`);
      }
      throw error; // rethrow other errors
    }
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().select("-password").exec();
  }

  async findOne(id: string): Promise<User> {
    return this.userModel.findById(id).select("-password").exec();
  }

  async findByEmail(email: string): Promise<UserDocument> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument> {
    return this.userModel.findOne({ phone }).exec();
  }

  async findByEmailOrPhone(
    email?: string,
    phone?: string
  ): Promise<UserDocument> {
    if (email) {
      return this.userModel.findOne({ email }).exec();
    }
    if (phone) {
      return this.userModel.findOne({ phone }).exec();
    }
    return null;
  }

  async findAgents(): Promise<any[]> {
    const agents = await this.userModel.aggregate([
      { $match: { role: "agent" } },
      {
        $lookup: {
          from: "parcels",
          localField: "_id",
          foreignField: "agentId",
          as: "assignedParcels",
        },
      },
      {
        $addFields: {
          performance: {
            totalAssigned: { $size: "$assignedParcels" },
            totalCompleted: {
              $size: {
                $filter: {
                  input: "$assignedParcels",
                  as: "parcel",
                  cond: { $eq: ["$$parcel.status", ParcelStatus.DELIVERED] },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          "performance.completionRate": {
            $cond: {
              if: { $gt: ["$performance.totalAssigned", 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      "$performance.totalCompleted",
                      "$performance.totalAssigned",
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          password: 0,
          assignedParcels: 0,
        },
      },
    ]);

    return agents;
  }

  async remove(id: string): Promise<User> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
