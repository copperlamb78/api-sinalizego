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
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CreateUserDto } from './dto/user-create.dto';
import { UpdateUserDto } from './dto/user-update.dto';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import type { Request } from 'express';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_NO_EMPLOYEE,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { RolesGuard } from '../auth/roles/guard/roles.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  @ApiBody({ type: CreateUserDto, description: 'Criar usuário' })
  @ApiResponse({ status: 400, description: 'Erro ao criar usuário' })
  @ApiResponse({ status: 409, description: 'E-mail já está em uso' })
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
  @ApiResponse({
    status: 200,
    description: 'Lista de usuários retornada com sucesso',
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
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('update/:userId')
  @ApiBody({ type: CreateUserDto, description: 'Atualizar usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário atualizado com sucesso',
    schema: {
      example: {
        id: 'clsw0s98x000013z81z8z8z8z',
        name: 'João Silva Atualizado',
        email: 'joao.silva.updated@example.com',
        phone: '5561999999999',
        role: 'USER',
        createdAt: '2026-07-18T10:33:00.000Z',
        isActive: true,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async updateUser(@Req() req: Request, @Body() data: UpdateUserDto) {
    const userId = req.user?.['sub'];
    return this.usersService.updateUser(userId, data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...INTERNAL_NO_EMPLOYEE)
  @Delete('deactivate/:userId')
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
