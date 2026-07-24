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
import { CompanyService } from './company.service';
import {
  CreateCompanyDto,
  CreateCompanyWithoutUserDto,
} from './dto/company-create.dto';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { UpdateCompanyDto } from './dto/company-update.dto';
import type { Request } from 'express';
import { FilterCompanyDto } from './dto/company-filter.dto';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  INTERNAL_USERS,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('create')
  @ApiBody({
    type: CreateCompanyDto,
    description: 'Criar empresa',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao criar empresa',
  })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiResponse({
    status: 201,
    description: 'Empresa criada com sucesso',
    schema: {
      example: {
        message: 'Empresa criada com sucesso',
        user: {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'Carlos Alberto',
          email: 'carlos@barbershop.com',
          phone: '75999999999',
          role: 'COMPANY_OWNER',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
          companies: [
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
  async createCompany(@Body() data: CreateCompanyDto) {
    return this.companyService.createCompanyWithUser(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('get-by-user-id')
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada com sucesso',
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
    description: 'Nenhuma empresa encontrada para este usuário.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getCompanyByUserId(@Body('userId') userId: string) {
    return this.companyService.getCompanyByUserId(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Get('list')
  @ApiResponse({
    status: 200,
    description: 'Lista de empresas retornada com sucesso',
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
  @ApiResponse({
    status: 404,
    description: 'Nenhuma empresa encontrada para este usuário.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllCompaniesByUserId(
    @Req() req: Request,
    @Query() filters?: FilterCompanyDto,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.getAllCompaniesByUserId(userId, filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Get('get-all')
  @ApiResponse({
    status: 200,
    description: 'Lista de empresas retornada com sucesso',
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
  async getAllCompanies() {
    return this.companyService.getAllCompanies();
  }

  @Get('get-by-slug/:slug')
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada com sucesso',
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
    description: 'Nenhuma empresa encontrada para este slug.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getCompanyBySlug(@Param('slug') slug: string) {
    return this.companyService.getCompanyBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('update/:companyId')
  @ApiBody({
    type: UpdateCompanyDto,
    description: 'Atualizar empresa',
  })
  @ApiResponse({
    status: 200,
    description: 'Empresa atualizada com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        businessName: "Barber's Shop Atualizada",
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
        banner:
          'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/banner/public_id.jpg',
        logo: 'https://res.cloudinary.com/sinalizego/image/upload/v1700000000/sinalizego/companyId/logo/public_id.jpg',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Nenhuma empresa encontrada para este usuário ou empresa.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async updateCompany(
    @Param('companyId') companyId: string,
    @Body() data: UpdateCompanyDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.updateCompany(userId, companyId, data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('deactivate/:companyId')
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @ApiResponse({
    status: 200,
    description: 'Empresa desativada com sucesso',
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
        isActive: false,
        disabledAt: '2026-07-18T10:33:00.000Z',
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhuma empresa encontrada para este usuário ou empresa não encontrada.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async deactivateCompany(
    @Param('companyId') companyId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.deactivateCompany(userId, companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('activate/:companyId')
  @ApiResponse({
    status: 200,
    description: 'Empresa ativada com sucesso',
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
        disabledAt: null,
        userId: 'clsw0s98x000013z81z8z8z8z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Nenhuma empresa encontrada para este usuário ou empresa não encontrada.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async activateCompany(
    @Param('companyId') companyId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.activateCompany(userId, companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('create-company-to-user')
  @ApiBody({
    type: CreateCompanyWithoutUserDto,
    description: 'Criar empresa para um usuário existente',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao criar empresa',
  })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiResponse({
    status: 201,
    description: 'Empresa criada com sucesso',
    schema: {
      example: {
        message: 'Empresa criada com sucesso',
        user: {
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
    },
  })
  async createCompanyToUser(
    @Body() data: CreateCompanyWithoutUserDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.['sub'];
    return this.companyService.createCompany(data, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_USERS)
  @Get('get-by-id/:companyId')
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada com sucesso',
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
    description: 'Nenhuma empresa encontrada para este ID.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getCompanyById(@Param('companyId') companyId: string) {
    return this.companyService.getCompanyByCompanyId(companyId);
  }
}
