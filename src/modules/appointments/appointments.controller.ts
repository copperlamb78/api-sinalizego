import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { CreateAppointmentsDto } from './dto/appointments-create.dto';
import type { Request } from 'express';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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
}
