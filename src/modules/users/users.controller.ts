import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/user-create.dto';
import { UpdateUserDto } from './dto/user-update.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateCpfCnpjDto } from './dto/update-cpf-cnpj.dto';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import type { Request } from 'express';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('create')
  @ApiOperation({ summary: 'Cria um novo usuário na plataforma' })
  @ApiBody({ type: CreateUserDto, description: 'Criar usuário' })
  @ApiResponse({ status: 400, description: 'Erro ao criar usuário' })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
  @ApiResponse({
    status: 429,
    description:
      'Muitas contas criadas em curto intervalo. Tente novamente mais tarde.',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso',
    schema: {
      example: {
        message: 'Usuário criado com sucesso',
        user: {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'João Silva',
          email: 'joao.silva@example.com',
          phone: '5561999999999',
          role: 'USER',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
        },
      },
    },
  })
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SYSTEM_MANAGERS)
  @Get('list')
  @ApiOperation({
    summary: 'Lista todos os usuários do sistema (Apenas administradores)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de usuários retornada com sucesso (senhas e tokens omitidos)',
    schema: {
      example: [
        {
          id: 'clsw0s98x000013z81z8z8z8z',
          name: 'João Silva',
          email: 'joao.silva@example.com',
          phone: '5561999999999',
          role: 'USER',
          createdAt: '2026-07-18T10:33:00.000Z',
          isActive: true,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @ApiOperation({
    summary: 'Atualiza os dados cadastrais (nome, telefone) do usuário logado',
  })
  @ApiBody({ type: UpdateUserDto, description: 'Atualizar usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário atualizado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'João Silva Atualizado',
        email: 'joao.silva@example.com',
        phone: '5561999999999',
        role: 'USER',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async updateUser(@Req() req: Request, @Body() data: UpdateUserDto) {
    const userId = req.user?.['sub'];
    return this.usersService.updateUser(userId, data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiOperation({
    summary:
      'Altera a senha do usuário logado mediante confirmação da senha atual',
  })
  @ApiBody({ type: ChangePasswordDto, description: 'Senha atual e nova senha' })
  @ApiResponse({
    status: 200,
    description: 'Senha alterada com sucesso',
    schema: {
      example: {
        message: 'Senha alterada com sucesso.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Senha atual incorreta' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const userId = req.user?.['sub'];
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('update-cpf')
  @ApiOperation({
    summary:
      'Atualiza o CPF/CNPJ do usuário logado e gera a conta de cliente no Asaas',
    description:
      'Atualiza o CPF/CNPJ do usuário autenticado no banco de dados e cria automaticamente o Customer ID na API do Asaas para pagamentos via Pix.',
  })
  @ApiBody({
    type: UpdateCpfCnpjDto,
    description: 'CPF (11 dígitos) ou CNPJ (14 dígitos) do usuário',
  })
  @ApiResponse({
    status: 200,
    description:
      'CPF/CNPJ atualizado e cliente financeiro gerado no Asaas com sucesso',
    schema: {
      example: {
        message: 'CPF atualizado e cliente financeiro gerado com sucesso!',
        user: {
          id: 'clsw0s98x000013z81z8z8z8z',
          cpfCnpj: '12345678909',
          asaasCustomerId: 'cus_000006093120',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dados de entrada inválidos ou erro na API do Asaas',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado (token JWT inválido ou ausente)',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async updateCpfCnpj(
    @Req() req: Request,
    @Body() updateCpfCnpjDto: UpdateCpfCnpjDto,
  ) {
    const userId = req.user?.['sub'];
    return this.usersService.updateCpfCnpjAndCreateCustomerId(
      userId,
      updateCpfCnpjDto.cpfCnpj,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Delete('deactivate/:userId')
  @ApiOperation({ summary: 'Desativa o cadastro do usuário (Soft Delete)' })
  @ApiResponse({
    status: 200,
    description: 'Usuário desativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'João Silva',
        email: 'joao.silva@example.com',
        phone: '5561999999999',
        role: 'USER',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: false,
        disabledAt: '2026-07-18T10:33:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async deactivateUser(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.usersService.deactivateUser(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Patch('activate/:userId')
  @ApiOperation({ summary: 'Reativa o cadastro do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário ativado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'João Silva',
        email: 'joao.silva@example.com',
        phone: '5561999999999',
        role: 'USER',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
        disabledAt: null,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async activateUser(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.usersService.activateUser(userId);
  }
}
