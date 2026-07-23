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
import { ProvidersServiceService } from './providers-service.service';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import type { Request } from 'express';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ListServiceBySlugDto } from './dto/list-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';

@Controller('providers-service')
export class ProvidersServiceController {
  constructor(
    private readonly providersServiceService: ProvidersServiceService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('create')
  @ApiBody({ type: CreateServiceDto, description: 'Criar serviço' })
  @ApiResponse({
    status: 201,
    description: 'Serviço criado com sucesso',
    schema: {
      example: {
        id: 'clsw0s2b0003138mg1wmg1wmg1',
        name: 'Corte de Cabelo',
        description: 'Corte de cabelo masculino e feminino',
        durationMinutes: 60,
        totalPrice: 50.0,
        downPaymentPercent: 10,
        availableEmployers: 2,
        providerId: 'clsw0s2b0003138mg1wmg1wmg1',
        createdAt: '2023-11-20T17:21:51.000Z',
        updatedAt: '2023-11-20T17:21:51.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhum negócio encontrado para este usuário.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async create(@Body() data: CreateServiceDto, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.providersServiceService.createService(data, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('list')
  @ApiResponse({
    status: 200,
    description: 'Lista de serviços retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s2b0003138mg1wmg1wmg1',
          name: 'Corte de Cabelo',
          description: 'Corte de cabelo masculino e feminino',
          durationMinutes: 60,
          totalPrice: 50.0,
          downPaymentPercent: 10,
          availableEmployers: 2,
          providerId: 'clsw0s2b0003138mg1wmg1wmg1',
          createdAt: '2023-11-20T17:21:51.000Z',
          updatedAt: '2023-11-20T17:21:51.000Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhum negócio encontrado para este usuário.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async getServicesByProvider(
    @Req() req: Request,
    @Query() filters?: FilterServiceDto,
  ) {
    const userId = req.user?.['sub'];
    return this.providersServiceService.getServicesByProvider(userId, filters);
  }

  @Get('list/:slug')
  @ApiResponse({
    status: 200,
    description: 'Lista de serviços retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s2b0003138mg1wmg1wmg1',
          name: 'Corte de Cabelo',
          description: 'Corte de cabelo masculino e feminino',
          durationMinutes: 60,
          totalPrice: 50.0,
          downPaymentPercent: 10,
          availableEmployers: 2,
          providerId: 'clsw0s2b0003138mg1wmg1wmg1',
          createdAt: '2023-11-20T17:21:51.000Z',
          updatedAt: '2023-11-20T17:21:51.000Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhum negócio encontrado para este slug ou nenhum serviço encontrado para este negócio.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async getServicesBySlug(@Param('slug') slug: string) {
    return this.providersServiceService.getServicesBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('update/:serviceId')
  @ApiBody({ type: UpdateServiceDto, description: 'Atualizar serviço' })
  @ApiResponse({
    status: 200,
    description: 'Serviço atualizado com sucesso',
    schema: {
      example: {
        id: 'clsw0s2b0003138mg1wmg1wmg1',
        name: 'Corte de Cabelo Atualizado',
        description: 'Corte de cabelo masculino e feminino com novos produtos',
        durationMinutes: 75,
        totalPrice: 60.0,
        downPaymentPercent: 15,
        availableEmployers: 3,
        providerId: 'clsw0s2b0003138mg1wmg1wmg1',
        createdAt: '2023-11-20T17:21:51.000Z',
        updatedAt: '2023-11-20T17:21:51.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhum negócio encontrado para este usuário ou serviço não encontrado.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async update(
    @Param('serviceId') serviceId: string,
    @Body() data: UpdateServiceDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.providersServiceService.updateService(userId, serviceId, data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Delete('deactivate/:serviceId')
  @ApiResponse({
    status: 200,
    description: 'Serviço desativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s2b0003138mg1wmg1wmg1',
        name: 'Corte de Cabelo',
        description: 'Corte de cabelo masculino e feminino',
        durationMinutes: 60,
        totalPrice: 50.0,
        downPaymentPercent: 10,
        availableEmployers: 2,
        providerId: 'clsw0s2b0003138mg1wmg1wmg1',
        createdAt: '2023-11-20T17:21:51.000Z',
        updatedAt: '2023-11-20T17:21:51.000Z',
        isActive: false,
        disabledAt: '2023-11-20T17:21:51.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhum negócio encontrado para este usuário ou serviço não encontrado.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async deactivateService(
    @Param('serviceId') serviceId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.providersServiceService.deactivateService(userId, serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('activate/:serviceId')
  @ApiResponse({
    status: 200,
    description: 'Serviço ativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s2b0003138mg1wmg1wmg1',
        name: 'Corte de Cabelo',
        description: 'Corte de cabelo masculino e feminino',
        durationMinutes: 60,
        totalPrice: 50.0,
        downPaymentPercent: 10,
        availableEmployers: 2,
        providerId: 'clsw0s2b0003138mg1wmg1wmg1',
        createdAt: '2023-11-20T17:21:51.000Z',
        updatedAt: '2023-11-20T17:21:51.000Z',
        isActive: true,
        disabledAt: null,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhum negócio encontrado para este usuário ou serviço não encontrado.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async activateService(
    @Param('serviceId') serviceId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.providersServiceService.activateService(userId, serviceId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Get('all')
  @ApiResponse({
    status: 200,
    description: 'Lista de todos os serviços retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s2b0003138mg1wmg1wmg1',
          name: 'Corte de Cabelo',
          description: 'Corte de cabelo masculino e feminino',
          durationMinutes: 60,
          totalPrice: 50.0,
          downPaymentPercent: 10,
          availableEmployers: 2,
          providerId: 'clsw0s2b0003138mg1wmg1wmg1',
          createdAt: '2023-11-20T17:21:51.000Z',
          updatedAt: '2023-11-20T17:21:51.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor.' })
  async getAllServices(@Query() filters?: FilterServiceDto) {
    return this.providersServiceService.getAllServices(filters);
  }
}
