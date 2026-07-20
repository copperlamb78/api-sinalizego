import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/providers-create.dto';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post('create')
  @ApiBody({
    type: CreateProviderDto,
    description: 'Criar prestador de serviços',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao criar prestador de serviços',
  })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiResponse({
    status: 201,
    description: 'Prestador de serviços criado com sucesso',
    schema: {
      example: {
        message: 'Prestador de serviços criado com sucesso',
        user: {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Carlos Alberto',
          email: 'carlos@barbershop.com',
          phone: '75999999999',
          role: 'PROVIDER',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          businesses: [
            {
              id: 'clsw0s98x000013z81z8z8z8z',
              businessName: "Barber's Shop",
              slug: 'barbers-shop',
              providerType: 'Barbearia',
              district: 'SIM',
              street: 'Artemia Pires Freitas',
              city: 'Feira de Santana',
              state: 'Bahia',
              zipCode: '44085370',
              number: '123',
              whatsapp: '75999999999',
              createdAt: '2026-07-18T10:33:00.000Z',
              isActive: true,
              userId: 'clsw0s98x000013z81z8z8z8z',
            },
          ],
        },
      },
    },
  })
  async createProvider(@Body() data: CreateProviderDto) {
    return this.providersService.createProvider(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('get-by-user-id')
  @ApiBody({
    schema: {
      example: {
        userId: 'clsw0s2b0003138mg1wmg1wmg1',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Prestador de serviços encontrado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop",
        slug: 'barbers-shop',
        providerType: 'Barbearia',
        district: 'SIM',
        street: 'Artemia Pires Freitas',
        city: 'Feira de Santana',
        state: 'Bahia',
        zipCode: '44085370',
        number: '123',
        whatsapp: '75999999999',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhum negócio encontrado para este usuário.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getProviderByUserId(@Body('userId') userId: string) {
    return this.providersService.getProviderByUserId(userId);
  }

  @Get('get-all')
  @ApiResponse({
    status: 200,
    description: 'Lista de prestadores de serviços retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          businessName: "Barber's Shop",
          slug: 'barbers-shop',
          providerType: 'Barbearia',
          district: 'SIM',
          street: 'Artemia Pires Freitas',
          city: 'Feira de Santana',
          state: 'Bahia',
          zipCode: '44085370',
          number: '123',
          whatsapp: '75999999999',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          userId: 'clsw0s98x000013z81z8z8z8z',
        },
      ],
    },
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllProviders() {
    return this.providersService.getAllProviders();
  }
}
