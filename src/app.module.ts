import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ParcelsModule } from "./parcels/parcels.module";
import { EventsModule } from "./gateway/events.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || "mongodb://localhost:27017/parcel-management"
    ),
    AuthModule,
    UsersModule,
    ParcelsModule,
    EventsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
