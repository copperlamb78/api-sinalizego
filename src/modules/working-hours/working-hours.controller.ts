import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WorkingHoursService } from './working-hours.service';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  INTERNAL_USERS,
} from 'src/common/constants/role-groups.constant';
import type { Request } from 'express';

@ApiTags('Horários de Funcionamento')
@Controller('working-hours')
export class WorkingHoursController {
  constructor(private readonly workingHoursService: WorkingHoursService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Put()
  @ApiOperation({
    summary: 'Atualiza a grade semanal de funcionamento da empresa',
  })
  @ApiBody({ type: UpdateWorkingHoursDto })
  @ApiResponse({
    status: 200,
    description: 'Grade semanal de horários atualizada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação nos horários informados',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta empresa' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  async updateWorkingHours(
    @Body() dto: UpdateWorkingHoursDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    const role = req.user?.['role'];
    return this.workingHoursService.updateWorkingHours(userId, dto, role);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get()
  @ApiOperation({
    summary: 'Retorna a grade semanal de horários da empresa autenticada',
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'ID da empresa (apenas para administradores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Grade de horários retornada com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  async getWorkingHours(
    @Req() req: Request,
    @Query('companyId') companyId?: string,
  ) {
    const userId = req.user?.['sub'];
    const role = req.user?.['role'];
    return this.workingHoursService.getWorkingHours(userId, companyId, role);
  }

  @Get('company/:companyId')
  @ApiOperation({
    summary: 'Consulta pública da grade de horários de uma empresa',
  })
  @ApiParam({
    name: 'companyId',
    description: 'ID da empresa (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Grade de horários retornada com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  async getWorkingHoursByCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.workingHoursService.getWorkingHoursByCompanyId(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('exceptions')
  @ApiOperation({
    summary:
      'Cadastra uma exceção na agenda da empresa (feriado, folga ou horário especial)',
  })
  @ApiBody({ type: CreateScheduleExceptionDto })
  @ApiResponse({
    status: 201,
    description: 'Exceção de agenda cadastrada com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação na data/horário',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta empresa' })
  async createScheduleException(
    @Body() dto: CreateScheduleExceptionDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    const role = req.user?.['role'];
    return this.workingHoursService.createScheduleException(userId, dto, role);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('exceptions')
  @ApiOperation({
    summary: 'Lista exceções futuras na agenda da empresa autenticada',
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'ID da empresa (apenas para administradores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de exceções retornada com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async getScheduleExceptions(
    @Req() req: Request,
    @Query('companyId') companyId?: string,
  ) {
    const userId = req.user?.['sub'];
    const role = req.user?.['role'];
    return this.workingHoursService.getScheduleExceptions(
      userId,
      companyId,
      role,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Delete('exceptions/:id')
  @ApiOperation({
    summary: 'Remove/desativa uma exceção de agenda',
  })
  @ApiParam({
    name: 'id',
    description: 'ID da exceção (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Exceção removida com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Exceção não encontrada' })
  async deleteScheduleException(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    const role = req.user?.['role'];
    return this.workingHoursService.deleteScheduleException(id, userId, role);
  }
}
