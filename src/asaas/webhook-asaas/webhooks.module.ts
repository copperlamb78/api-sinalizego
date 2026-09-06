import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WebhooksService } from './webhooks.service';
import { AsaasModule } from '../asaas.module';
import { MailModule } from 'src/modules/mail/mail.module';
import { FoundersModule } from 'src/modules/founders/founders.module';
import { ReferralsModule } from 'src/modules/referrals/referrals.module';

@Module({
  imports: [
    PrismaModule,
    AsaasModule,
    MailModule,
    FoundersModule,
    ReferralsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
