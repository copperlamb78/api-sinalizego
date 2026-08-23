import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from './dto/user-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // Gera o token e o refresh token para o usuário autenticado
  async getTokens(userId: string, email: string, role: string) {
    const jwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '30d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Conta desativada.');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive || !user.refreshToken) {
      throw new ForbiddenException('Acesso Negado');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Acesso Negado');
    }

    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return user;
  }

  async logout(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logout realizado com sucesso.' };
  }

  async forgotPassword(data: ForgotPasswordDto) {
    const genericResponse = {
      message:
        'Se o e-mail informado estiver cadastrado, as instruções para redefinição de senha foram enviadas.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
      },
    });

    if (!user) {
      return genericResponse;
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('Critical Security: JWT_SECRET is not defined.');
    }
    const secret = `${process.env.JWT_SECRET}${user.password}`;
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret,
        expiresIn: '15m',
      },
    );

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetLink,
    );

    return genericResponse;
  }

  async resetPassword(data: ResetPasswordDto) {
    let payload: any;
    try {
      payload = this.jwtService.decode(data.token);
    } catch {
      throw new BadRequestException('Token de recuperação malformado.');
    }

    if (!payload || !payload.sub || typeof payload.sub !== 'string') {
      throw new BadRequestException('Token de recuperação inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Token inválido ou usuário não encontrado.',
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('Critical Security: JWT_SECRET is not defined.');
    }
    const secret = `${process.env.JWT_SECRET}${user.password}`;
    try {
      await this.jwtService.verifyAsync(data.token, { secret });
    } catch {
      throw new UnauthorizedException(
        'Token de recuperação expirado ou inválido.',
      );
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null, // Desloga sessões ativas
      },
    });

    return { message: 'Senha redefinida com sucesso.' };
  }
}
