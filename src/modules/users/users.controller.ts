import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { CreateUserDto } from './dto/user-create.dto';

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
}
