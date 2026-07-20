import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ProvidersModule } from './modules/providers/providers.module';
import { ProvidersServiceModule } from './modules/providers-service/providers-service.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProvidersModule,
    ProvidersServiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
