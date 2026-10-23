import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import 'dotenv/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token JWT inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        refreshToken: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Conta desativada ou usuário não encontrado.',
      );
    }

    // Validação de Vínculo de Sessão Ativa (Anti-Zombie Session)
    if (payload.sid) {
      if (!user.refreshToken) {
        throw new UnauthorizedException(
          'Sessão encerrada. Faça login novamente.',
        );
      }
      const activeSid = user.refreshToken.includes(':')
        ? user.refreshToken.slice(0, user.refreshToken.indexOf(':'))
        : null;
      if (activeSid && activeSid !== payload.sid) {
        throw new UnauthorizedException(
          'Sessão expirada ou substituída por outro login.',
        );
      }
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
