import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import 'dotenv/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Pega o token do cabeçalho de Autorização (Bearer Token)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Rejeita tokens vencidos
      ignoreExpiration: false, // Define como false para que o Passport-JWT rejeite automaticamente tokens expirados
      // Usa a mesma chave secreta que usamos para gerar o token
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  // Se o token for válido, o NestJS chama essa função automaticamente.
  // O que retornarmos aqui ficará disponível na requisição (req.user)
  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
