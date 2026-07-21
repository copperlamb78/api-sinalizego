import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProvidersServiceService } from './providers-service.service';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import type { Request } from 'express';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ListServiceBySlugDto } from './dto/list-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('providers-service')
export class ProvidersServiceController {
  constructor(
    private readonly providersServiceService: ProvidersServiceService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('create')
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

  //crie a rota para buscar todos os serviços de um provider, usando o userId do token JWT
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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
  async getServicesByProvider(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.providersServiceService.getServicesByProvider(userId);
  }

  // crie a rota para buscar todos os serviços de um provider, usando o slug do provider que será passado como parametro na rota, e retorne uma lista de serviços
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
  @UseGuards(JwtAuthGuard)
  @Patch('update/:serviceId')
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
  @UseGuards(JwtAuthGuard)
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
}
