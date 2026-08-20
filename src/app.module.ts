import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
