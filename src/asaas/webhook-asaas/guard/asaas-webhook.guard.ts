import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import 'dotenv/config';

@Injectable()
export class AsaasWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tokenHeader = request.headers['asaas-access-token'];
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

    if (!tokenHeader || !expectedToken) {
      throw new UnauthorizedException('Token de webhook inválido ou ausente.');
    }

    const tokenBuffer = Buffer.from(String(tokenHeader));
    const expectedBuffer = Buffer.from(String(expectedToken));

    if (
      tokenBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Token de webhook inválido ou ausente.');
    }

    return true;
  }
}
