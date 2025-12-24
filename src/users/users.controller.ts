import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "./schemas/user.schema";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("agents")
  @Roles(UserRole.ADMIN)
  createAgent(@Body() createAgentDto: any) {
    return this.usersService.create({
      ...createAgentDto,
      role: UserRole.AGENT,
    });
  }
  @Post("customers")
  @Roles(UserRole.ADMIN)
  createCustomers(@Body() createCustomersDto: any) {
    return this.usersService.create({
      ...createCustomersDto,
      role: UserRole.CUSTOMER,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get("agents")
  @Roles(UserRole.ADMIN)
  findAgents() {
    return this.usersService.findAgents();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateUserDto: any) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }
}
