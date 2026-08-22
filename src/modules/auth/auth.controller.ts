import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/user-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtRefreshGuard } from './jwt/guard/jwt-refresh.guard';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt/guard/jwt-auth.guard';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiBody({ type: LoginDto, description: 'Credenciais de login do usuário' })
  @ApiOperation({ summary: 'Realiza a autenticação do usuário' })
  @ApiResponse({
    status: 201,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
  @ApiOperation({ summary: 'Renova os tokens de acesso e refresh' })
  @ApiResponse({
    status: 200,
    description: 'Tokens de acesso e refresh atualizados com sucesso',
  })
  @ApiResponse({ status: 403, description: 'Acesso Negado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  refreshTokens(@Req() req: Request) {
    const userId = req.user?.['sub'];
    const refreshToken = req.user?.['refreshToken'];
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Obtém o perfil do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Informações do usuário autenticado',
  })
  @ApiResponse({ status: 403, description: 'Acesso Negado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  me(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.authService.me(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Encerra a sessão do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Logout realizado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  logout(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.authService.logout(userId);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Solicita a recuperação de senha enviando link por e-mail',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description:
      'Resposta genérica de segurança (instruções enviadas se e-mail existir)',
    schema: {
      example: {
        message:
          'Se o e-mail informado estiver cadastrado, as instruções para redefinição de senha foram enviadas.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'E-mail inválido' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary:
      'Redefine a senha utilizando o token stateless recebido por e-mail',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Senha redefinida com sucesso',
    schema: {
      example: {
        message: 'Senha redefinida com sucesso.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token inválido ou malformado' })
  @ApiResponse({ status: 401, description: 'Token expirado ou inválido' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
