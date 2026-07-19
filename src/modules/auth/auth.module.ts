import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import 'dotenv/config';
import { JwtStrategy } from './jwt/strategy/jwt.strategy';
import { JwtRefreshStrategy } from './jwt/strategy/jwt-refresh.strategy';

@Module({
  imports: [PassportModule, JwtModule],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
