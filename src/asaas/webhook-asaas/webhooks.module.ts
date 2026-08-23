import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WebhooksService } from './webhooks.service';
import { AsaasModule } from '../asaas.module';
import { MailModule } from 'src/modules/mail/mail.module';

@Module({
  imports: [PrismaModule, AsaasModule, MailModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
