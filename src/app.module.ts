import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './modules/company/company.module';
import { CompanyServiceModule } from './modules/company-service/company-service.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { UploadModule } from './cloudinary/upload/upload.module';
import { AsaasModule } from './asaas/asaas.module';
import { FinancialProfileModule } from './modules/financial-profile/financial-profile.module';
import { WebhooksModule } from './asaas/webhook-asaas/webhooks.module';
import { ServiceGroupModule } from './service-group/service-group.module';
import { MailModule } from './modules/mail/mail.module';
import { WorkingHoursModule } from './modules/working-hours/working-hours.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 40,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    CompanyModule,
    CompanyServiceModule,
    TransactionsModule,
    AppointmentsModule,
    CloudinaryModule,
    UploadModule,
    AsaasModule,
    FinancialProfileModule,
    WebhooksModule,
    ServiceGroupModule,
    MailModule,
    WorkingHoursModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
