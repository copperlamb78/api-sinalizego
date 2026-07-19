import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/user-login.dto';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { JwtRefreshGuard } from './jwt/guard/jwt-refresh.guard';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @ApiBody({ type: LoginDto, description: 'Credenciais de login do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        access_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHN3MHMyYjAwMDMxMzhtZzF3bWcxd21nMSIsImVtYWlsIjoiam9hby5zaWx2YUBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzA1MTYxNjAwLCJleHAiOjE3MDUyNDgwMDB9.your_jwt_token_here',
        user: {
          id: 'clsw0s2b0003138mg1wmg1wmg1',
          name: 'João Silva',
          email: 'joao.silva@example.com',
          role: 'USER',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Senha inválida' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Post('login')
  async login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiResponse({
    status: 200,
    description: 'Tokens de acesso e refresh atualizados com sucesso',
    schema: {
      example: {
        access_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHN3MHMyYjAwMDMxMzhtZzF3bWcxd21nMSIsImVtYWlsIjoiam9hby5zaWx2YUBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzA1MTYxNjAwLCJleHAiOjE3MDUyNDgwMDB9.your_new_jwt_token_here',
        refresh_token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHN3MHMyYjAwMDMxMzhtZzF3bWcxd21nMSIsImVtYWlsIjoiam9hby5zaWx2YUBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzA1MTYxNjAwLCJleHAiOjE3MDUyNDgwMDB9.your_new_refresh_token_here',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Acesso Negado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  refreshTokens(@Req() req: Request) {
    const userId = req.user?.['sub'];
    const refreshToken = req.user?.['refreshToken'];
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
