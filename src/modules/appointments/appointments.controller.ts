import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { CreateAppointmentsDto } from './dto/appointments-create.dto';
import type { Request } from 'express';
import {
  AppointmentsSuperFiltersDto,
  AppointmentsAdminFiltersDto,
  AppointmentsFiltersDto,
} from './dto/appointments-filters.dto';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { INTERNAL_USERS } from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiOperation({ summary: 'Cria um novo agendamento' })
  @ApiResponse({
    status: 201,
    description: 'Agendamento criado com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Requisição inválida' })
  @ApiResponse({ status: 404, description: 'Recurso não encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Não há vagas disponíveis para este serviço neste horário',
  })
  async create(@Body() data: CreateAppointmentsDto, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.createAppointment(data, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get()
  @ApiOperation({
    summary: 'Retorna todos os agendamentos (apenas para super admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Agendamentos encontrados com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Nenhum agendamento encontrado' })
  async findAll(@Query() filters: AppointmentsSuperFiltersDto) {
    return this.appointmentsService.getAppointments(filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('provider')
  @ApiOperation({
    summary: 'Retorna agendamentos de um provedor específico',
  })
  @ApiResponse({
    status: 200,
    description: 'Agendamentos encontrados com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Nenhum agendamento encontrado' })
  async findByProvider(
    @Req() req: Request,
    @Query() filters: AppointmentsAdminFiltersDto,
  ) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.getAppointmentByProviderId(userId, filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('user')
  @ApiOperation({ summary: 'Retorna agendamentos de um usuário específico' })
  @ApiResponse({
    status: 200,
    description: 'Agendamentos encontrados com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Nenhum agendamento encontrado' })
  async findByUser(
    @Req() req: Request,
    @Query() filters: AppointmentsFiltersDto,
  ) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.getAppointmentByUserId(userId, filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza o status de um agendamento' })
  @ApiResponse({
    status: 200,
    description: 'Status do agendamento atualizado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Agendamento não encontrado' })
  async updateStatus(
    @Param('id') appointmentId: string,
    @Body('status') status: string,
  ) {
    return this.appointmentsService.updateAppointmentStatus(
      appointmentId,
      status,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/deactivate')
  @ApiOperation({ summary: 'Desativa um agendamento' })
  @ApiResponse({
    status: 200,
    description: 'Agendamento desativado com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Agendamento já está inativo' })
  @ApiResponse({ status: 404, description: 'Agendamento não encontrado' })
  async deactivate(@Param('id') appointmentId: string, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.deactivateAppointment(
      appointmentId,
      userId,
    );
  }
}
