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
import { ServiceGroupService } from './service-group.service';
import { CreateServiceGroupDto } from './dto/create-service-group.dto';
import { UpdateServiceGroupDto } from './dto/update-service-group.dto';
import { FiltersServiceGroupDto } from './dto/filters-service-group.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../modules/auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/roles/guard/roles.guard';
import { Roles } from '../modules/auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  INTERNAL_USERS,
} from 'src/common/constants/role-groups.constant';
import type { Request } from 'express';

@ApiTags('Grupo de Serviços')
@Controller('service-group')
export class ServiceGroupController {
  constructor(private readonly serviceGroupService: ServiceGroupService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post()
  @ApiOperation({ summary: 'Cria um novo grupo de serviços' })
  @ApiBody({
    type: CreateServiceGroupDto,
    description: 'Dados para criação do grupo de serviços',
  })
  @ApiResponse({
    status: 201,
    description: 'Grupo de serviços criado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Cabeleireiros',
        capacity: 2,
        companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados de requisição inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta empresa' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async create(
    @Body() createServiceGroupDto: CreateServiceGroupDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.serviceGroupService.create(createServiceGroupDto, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get()
  @ApiOperation({ summary: 'Lista todos os grupos de serviços (com filtros)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de grupos de serviços retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Cabeleireiros',
          capacity: 2,
          companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async findAll(@Query() filters?: FiltersServiceGroupDto) {
    return this.serviceGroupService.findAll(filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('company/:companyId')
  @ApiOperation({
    summary: 'Lista todos os grupos de serviços de uma empresa específica',
  })
  @ApiParam({
    name: 'companyId',
    description: 'ID da empresa (UUID)',
    example: '6e463255-9c3e-47e1-b417-60382e3d2223',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de grupos de serviços da empresa retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Cabeleireiros',
          capacity: 2,
          companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta empresa' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async findAllByCompanyId(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Req() req: Request,
    @Query() filters?: FiltersServiceGroupDto,
  ) {
    const userId = req.user?.['sub'];
    return this.serviceGroupService.findAllByCompanyId(
      companyId,
      userId,
      filters,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get(':id')
  @ApiOperation({ summary: 'Busca um grupo de serviços pelo ID' })
  @ApiParam({
    name: 'id',
    description: 'ID único do grupo de serviços (UUID)',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description: 'Grupo de serviços encontrado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Cabeleireiros',
        capacity: 2,
        companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Grupo de serviços não encontrado',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceGroupService.findOneById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um grupo de serviços pelo ID' })
  @ApiParam({
    name: 'id',
    description: 'ID único do grupo de serviços (UUID)',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiBody({
    type: UpdateServiceGroupDto,
    description: 'Dados para atualização do grupo de serviços',
  })
  @ApiResponse({
    status: 200,
    description: 'Grupo de serviços atualizado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Cabeleireiros & Barbeiros',
        capacity: 4,
        companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados de requisição inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado para este grupo de serviços',
  })
  @ApiResponse({
    status: 404,
    description: 'Grupo de serviços não encontrado',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceGroupDto: UpdateServiceGroupDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.serviceGroupService.update(id, userId, updateServiceGroupDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('company/:companyId/:id')
  @ApiOperation({
    summary: 'Atualiza um grupo de serviços de uma empresa específica',
  })
  @ApiParam({
    name: 'companyId',
    description: 'ID da empresa (UUID)',
    example: '6e463255-9c3e-47e1-b417-60382e3d2223',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único do grupo de serviços (UUID)',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiBody({
    type: UpdateServiceGroupDto,
    description: 'Dados para atualização do grupo de serviços',
  })
  @ApiResponse({
    status: 200,
    description: 'Grupo de serviços atualizado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Cabeleireiros & Barbeiros',
        capacity: 4,
        companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados de requisição inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado para esta empresa' })
  @ApiResponse({
    status: 404,
    description: 'Grupo de serviços não encontrado para esta empresa',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async updateByCompanyId(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() updateServiceGroupDto: UpdateServiceGroupDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.serviceGroupService.updateByCompanyId(
      id,
      companyId,
      userId,
      updateServiceGroupDto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Delete(':id')
  @ApiOperation({ summary: 'Desativa/remove um grupo de serviços pelo ID' })
  @ApiParam({
    name: 'id',
    description: 'ID único do grupo de serviços a ser removido (UUID)',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description: 'Grupo de serviços desativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Cabeleireiros',
        capacity: 2,
        companyId: '6e463255-9c3e-47e1-b417-60382e3d2223',
        isActive: false,
        disabledAt: '2026-08-19T21:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Grupo possui serviços ativos vinculados',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado para este grupo de serviços',
  })
  @ApiResponse({
    status: 404,
    description: 'Grupo de serviços não encontrado',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.serviceGroupService.remove(id, userId);
  }
}
