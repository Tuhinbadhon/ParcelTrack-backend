import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { CreateParcelDto, UpdateParcelStatusDto, AssignAgentDto, UpdateLocationDto } from './dto/parcel.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('parcels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@Body() createParcelDto: CreateParcelDto, @CurrentUser() user: any) {
    return this.parcelsService.create(createParcelDto, user.id);
  }

  @Get()
  findAll(@Query('status') status?: string, @CurrentUser() user?: any) {
    const filters: any = {};
    if (status) filters.status = status;
    
    // If agent, only show their assigned parcels
    if (user.role === UserRole.AGENT) {
      filters.agentId = user.id;
    }
    
    // If customer, only show their parcels
    if (user.role === UserRole.CUSTOMER) {
      filters.senderId = user.id;
    }
    
    return this.parcelsService.findAll(filters);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  getStatistics() {
    return this.parcelsService.getStatistics();
  }

  @Get('track/:trackingNumber')
  findByTracking(@Param('trackingNumber') trackingNumber: string) {
    return this.parcelsService.findByTracking(trackingNumber);
  }

  @Get('my-parcels')
  @Roles(UserRole.CUSTOMER)
  findMyParcels(@CurrentUser() user: any) {
    return this.parcelsService.findBySender(user.id);
  }

  @Get('assigned')
  @Roles(UserRole.AGENT)
  findAssignedParcels(@CurrentUser() user: any) {
    return this.parcelsService.findByAgent(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.parcelsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.AGENT, UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateParcelStatusDto) {
    return this.parcelsService.updateStatus(id, updateStatusDto);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN)
  assignAgent(@Param('id') id: string, @Body() assignAgentDto: AssignAgentDto) {
    return this.parcelsService.assignAgent(id, assignAgentDto);
  }

  @Patch(':id/location')
  @Roles(UserRole.AGENT)
  updateLocation(@Param('id') id: string, @Body() updateLocationDto: UpdateLocationDto) {
    return this.parcelsService.updateLocation(id, updateLocationDto);
  }

    @Patch(":id/urgent")

  @Patch(':id/urgent')
  @Roles(UserRole.ADMIN)
  markUrgent(@Param('id') id: string) {
    return this.parcelsService.markUrgent(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.parcelsService.remove(id);
  }
}
