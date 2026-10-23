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

    // Revogação em tempo real: se o token foi emitido com vínculo de sessão (sid)
    // e a sessão foi encerrada (refreshToken limpo por logout, reset de senha ou desativação),
    // bloqueia imediatamente qualquer requisição autenticada.
    if (payload.sid && !user.refreshToken) {
      throw new UnauthorizedException(
        'Sessão encerrada. Faça login novamente.',
      );
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
