import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { FiltersEmployeeDto } from './dto/filters-employee.dto';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import { INTERNAL_USERS } from 'src/common/constants/role-groups.constant';
import type { Request } from 'express';

@ApiTags('Funcionários & Profissionais')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Post()
  @ApiOperation({ summary: 'Cadastra um novo funcionário na empresa autenticada' })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Funcionário cadastrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de requisição inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.employeesService.create(createEmployeeDto, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get()
  @ApiOperation({ summary: 'Lista os funcionários da empresa com filtros e paginação' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async findAll(
    @Req() req: Request,
    @Query() filters?: FiltersEmployeeDto,
  ) {
    const userId = req.user?.['sub'];
    return this.employeesService.findAll(userId, filters);
  }

  @Get('public/company/:companyId/service/:serviceId')
  @ApiOperation({ summary: 'Lista os profissionais habilitados para um serviço na vitrine pública' })
  @ApiParam({ name: 'companyId', description: 'ID da empresa (UUID)' })
  @ApiParam({ name: 'serviceId', description: 'ID do serviço (UUID)' })
  @ApiResponse({ status: 200, description: 'Profissionais habilitados retornados com sucesso' })
  async getPublicEmployeesByService(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.employeesService.getPublicEmployeesByService(companyId, serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get(':id/stats')
  @ApiOperation({ summary: 'Consulta os indicadores e estatísticas reais de um funcionário' })
  @ApiParam({ name: 'id', description: 'ID do funcionário (UUID)' })
  @ApiResponse({ status: 200, description: 'Estatísticas retornadas com sucesso' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.employeesService.getStats(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get(':id')
  @ApiOperation({ summary: 'Consulta os dados completos de um funcionário' })
  @ApiParam({ name: 'id', description: 'ID do funcionário (UUID)' })
  @ApiResponse({ status: 200, description: 'Dados do funcionário retornados com sucesso' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.employeesService.findOne(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza os dados e vínculos de um funcionário' })
  @ApiParam({ name: 'id', description: 'ID do funcionário (UUID)' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Funcionário atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados de requisição inválidos' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.employeesService.update(id, updateEmployeeDto, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Ativa ou desativa um funcionário (sem excluir registros)' })
  @ApiParam({ name: 'id', description: 'ID do funcionário (UUID)' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.employeesService.toggleStatus(id, userId);
  }
}
