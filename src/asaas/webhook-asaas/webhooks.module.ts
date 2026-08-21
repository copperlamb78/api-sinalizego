import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WebhooksService } from './webhooks.service';
import { AsaasModule } from '../asaas.module';

@Module({
  imports: [PrismaModule, AsaasModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
