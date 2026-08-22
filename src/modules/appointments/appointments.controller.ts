import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { CreateAppointmentsDto } from './dto/appointments-create.dto';
import type { Request } from 'express';
import {
  AppointmentsSuperFiltersDto,
  AppointmentsAdminFiltersDto,
  AppointmentsFiltersDto,
} from './dto/appointments-filters.dto';
import { AppointmentsStatusUpdateDto } from './dto/appointements-update.dto';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  INTERNAL_NO_EMPLOYEE,
  INTERNAL_USERS,
} from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';

@ApiTags('Agendamentos')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @ApiBody({ type: CreateAppointmentsDto, description: 'Criar agendamento' })
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
  @Get('company')
  @ApiOperation({
    summary: 'Retorna agendamentos de uma empresa específica',
  })
  @ApiResponse({
    status: 200,
    description: 'Agendamentos encontrados com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Nenhum agendamento encontrado' })
  async findByCompany(
    @Req() req: Request,
    @Query() filters: AppointmentsAdminFiltersDto,
  ) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.getAppointmentByCompanyId(userId, filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('user')
  @ApiOperation({ summary: 'Retorna agendamentos do cliente logado' })
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
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch(':id/status')
  @ApiBody({
    type: AppointmentsStatusUpdateDto,
    description: 'Atualizar status do agendamento (COMPLETED ou CANCELED)',
  })
  @ApiOperation({
    summary:
      'Atualiza o status de um agendamento da empresa (COMPLETED ou CANCELED)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do agendamento (UUID)',
    example: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
  })
  @ApiResponse({
    status: 200,
    description: 'Status do agendamento atualizado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Status inválido ou transição não permitida',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado para este agendamento',
  })
  @ApiResponse({ status: 404, description: 'Agendamento não encontrado' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Body() dto: AppointmentsStatusUpdateDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.updateAppointmentStatus(
      appointmentId,
      userId,
      dto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/deactivate')
  @ApiOperation({ summary: 'Desativa um agendamento' })
  @ApiParam({
    name: 'id',
    description: 'ID do agendamento (UUID)',
    example: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
  })
  @ApiResponse({
    status: 200,
    description: 'Agendamento desativado com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Agendamento já está inativo' })
  @ApiResponse({ status: 404, description: 'Agendamento não encontrado' })
  async deactivate(
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.appointmentsService.deactivateAppointment(
      appointmentId,
      userId,
    );
  }
}
