import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    console.log("=== JWT Guard ===");
    console.log("Auth Header:", request.headers.authorization);
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    console.log("JWT Error:", err);
    console.log("JWT Info:", info);
    console.log("User:", user ? "Found" : "Not found");

    if (err || !user) {
      throw err || new UnauthorizedException("Invalid token");
    }
    return user;
  }
}
