import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUrl,
} from "class-validator";
import { ParcelStatus, PaymentType } from "../schemas/parcel.schema";

export class CreateParcelDto {
  @IsOptional()
  @IsString()
  senderName: string;

  @IsNotEmpty()
  @IsString()
  recipientName: string;

  @IsNotEmpty()
  @IsString()
  recipientPhone: string;

  @IsNotEmpty()
  @IsString()
  recipientAddress: string;

  @IsOptional()
  @IsUrl()
  recipientMapLink?: string;

  @IsNotEmpty()
  @IsString()
  pickupAddress: string;

  @IsOptional()
  @IsUrl()
  pickupMapLink?: string;

  @IsNotEmpty()
  @IsNumber()
  weight: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsNotEmpty()
  @IsNumber()
  cost: number;
}

export class UpdateParcelStatusDto {
  @IsNotEmpty()
  @IsEnum(ParcelStatus)
  status: ParcelStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignAgentDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;
}

export class UpdateLocationDto {
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @IsNotEmpty()
  @IsNumber()
  lng: number;
}
