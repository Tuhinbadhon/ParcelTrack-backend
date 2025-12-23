import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
    console.log(
      "JWT Strategy initialized with secret:",
      configService.get<string>("JWT_SECRET")?.substring(0, 20) + "..."
    );
  }

  async validate(payload: any) {
    console.log("=== JWT Validation ===");
    console.log("Payload:", payload);
    try {
      const user = await this.usersService.findOne(payload.sub);
      console.log("User found:", user ? "YES" : "NO");
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        ...user,
      };
    } catch (error) {
      console.error("JWT validation error:", error);
      throw error;
    }
  }
}
