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
import { FinancialProfileService } from './financial-profile.service';
import { CreateFinancialProfileDto } from './dto/create-financial-profile.dto';
import {
  AdminFiltersFinancialProfileDto,
  FiltersFinancialProfileDto,
} from './dto/filters-financial-profile.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  INTERNAL_USERS,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import type { Request } from 'express';

@ApiTags('Perfil Financeiro')
@Controller('financial-profile')
export class FinancialProfileController {
  constructor(
    private readonly financialProfileService: FinancialProfileService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Post('create')
  @ApiOperation({
    summary: 'Cria o perfil financeiro (subconta Asaas) do usuário logado',
  })
  @ApiBody({
    type: CreateFinancialProfileDto,
    description: 'Dados para criação da subconta financeira no Asaas',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil financeiro criado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Barbearia do João LTDA',
        email: 'contato@barbearia.com',
        cpfCnpj: '12345678000195',
        birthDate: null,
        companyType: 'MEI',
        mobilePhone: '75999998888',
        incomeValue: 5000,
        address: 'Avenida Getúlio Vargas',
        addressNumber: '1500',
        province: 'Centro',
        postalCode: '44001000',
        userId: 'clsw0s98x000013z81z8z8z8z',
        createdAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Erro de validação (ex: data de nascimento obrigatória para CPF ou tipo de empresa para CNPJ)',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 409,
    description: 'Este CPF/CNPJ já está vinculado a outra conta no sistema',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async create(@Body() data: CreateFinancialProfileDto, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.financialProfileService.createFinancialProfile(data, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('list')
  @ApiOperation({
    summary:
      'Lista todos os perfis financeiros do usuário logado (com filtros)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de perfis financeiros retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Barbearia do João LTDA',
          email: 'contato@barbearia.com',
          cpfCnpj: '12345678000195',
          birthDate: null,
          companyType: 'MEI',
          mobilePhone: '75999998888',
          incomeValue: 5000,
          address: 'Avenida Getúlio Vargas',
          addressNumber: '1500',
          province: 'Centro',
          postalCode: '44001000',
          walletId: 'c92569ff-4e78-4333-a3d8-faef1220a232',
          userId: 'clsw0s98x000013z81z8z8z8z',
          createdAt: '2026-07-29T10:00:00.000Z',
          updatedAt: '2026-07-29T10:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Nenhum perfil encontrado para este usuário',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllByUserId(
    @Req() req: Request,
    @Query() filters?: FiltersFinancialProfileDto,
  ) {
    const userId = req.user?.['sub'];
    return this.financialProfileService.getAllFinancialProfilesByUserId(
      userId,
      filters,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Get('get-all')
  @ApiOperation({
    summary:
      'Lista todos os perfis financeiros do sistema (Apenas administradores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de perfis financeiros retornada com sucesso',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Barbearia do João LTDA',
          email: 'contato@barbearia.com',
          cpfCnpj: '12345678000195',
          birthDate: null,
          companyType: 'MEI',
          mobilePhone: '75999998888',
          incomeValue: 5000,
          address: 'Avenida Getúlio Vargas',
          addressNumber: '1500',
          province: 'Centro',
          postalCode: '44001000',
          walletId: 'c92569ff-4e78-4333-a3d8-faef1220a232',
          userId: 'clsw0s98x000013z81z8z8z8z',
          createdAt: '2026-07-29T10:00:00.000Z',
          updatedAt: '2026-07-29T10:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado (requer role de administração)',
  })
  @ApiResponse({ status: 404, description: 'Nenhum perfil encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllProfiles(@Query() filters?: AdminFiltersFinancialProfileDto) {
    return this.financialProfileService.getAllFinancialProfiles(filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('user/:id')
  @ApiOperation({
    summary:
      'Busca um perfil financeiro específico pertencente ao usuário logado pelo ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único do perfil financeiro',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil financeiro do usuário retornado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Barbearia do João LTDA',
        email: 'contato@barbearia.com',
        cpfCnpj: '12345678000195',
        birthDate: null,
        companyType: 'MEI',
        mobilePhone: '75999998888',
        incomeValue: 5000,
        address: 'Avenida Getúlio Vargas',
        addressNumber: '1500',
        province: 'Centro',
        postalCode: '44001000',
        walletId: 'c92569ff-4e78-4333-a3d8-faef1220a232',
        userId: 'clsw0s98x000013z81z8z8z8z',
        createdAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Perfil financeiro não encontrado para este usuário',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getByUserId(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.['sub'];
    return this.financialProfileService.getFinancialProfileByUserId(userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('get-by-id/:id')
  @ApiOperation({
    summary:
      'Busca detalhes de um perfil financeiro pelo ID (dados sensíveis ocultados)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do perfil financeiro',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description:
      'Perfil financeiro retornado com sucesso (dados sensíveis sanitizados)',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Barbearia do João LTDA',
        email: 'contato@barbearia.com',
        birthDate: null,
        companyType: 'MEI',
        mobilePhone: '75999998888',
        address: 'Avenida Getúlio Vargas',
        addressNumber: '1500',
        province: 'Centro',
        postalCode: '44001000',
        userId: 'clsw0s98x000013z81z8z8z8z',
        createdAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getById(@Param('id') id: string) {
    return this.financialProfileService.getFinancialProfileById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Delete('deactivate/:id')
  @ApiOperation({
    summary: 'Desativa um perfil financeiro do usuário logado (Soft Delete)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do perfil financeiro a ser desativado',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil financeiro desativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Barbearia do João LTDA',
        email: 'contato@barbearia.com',
        cpfCnpj: '12345678000195',
        mobilePhone: '75999998888',
        address: 'Avenida Getúlio Vargas',
        addressNumber: '1500',
        province: 'Centro',
        postalCode: '44001000',
        isActive: false,
        disabledAt: '2026-07-29T10:00:00.000Z',
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Perfil já está desativado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.financialProfileService.deactivateFinancialProfile(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('activate/:id')
  @ApiOperation({
    summary: 'Reativa um perfil financeiro do usuário logado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do perfil financeiro a ser reativado',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil financeiro ativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'Barbearia do João LTDA',
        email: 'contato@barbearia.com',
        cpfCnpj: '12345678000195',
        mobilePhone: '75999998888',
        address: 'Avenida Getúlio Vargas',
        addressNumber: '1500',
        province: 'Centro',
        postalCode: '44001000',
        isActive: true,
        disabledAt: null,
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Perfil já está ativado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async activate(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.financialProfileService.activateFinancialProfile(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('balance/:id')
  @ApiOperation({
    summary: 'Busca o saldo de um perfil financeiro do usuário logado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do perfil financeiro para buscar o saldo',
    example: 'clsw0s98x000013z81z8z8z8z',
  })
  @ApiResponse({
    status: 200,
    description: 'Saldo do perfil financeiro retornado com sucesso',
    schema: {
      example: {
        balance: 1234.56,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação ou erro retornado pelo Asaas',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Perfil financeiro não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getFinancialProfileBalance(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.financialProfileService.getFinancialProfileBalance(id, userId);
  }
}
