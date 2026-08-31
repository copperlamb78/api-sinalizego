import { AsaasWebhookDto } from './dto/asaas-webhook.dto';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AsaasWebhookGuard } from './guard/asaas-webhook.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { WebhooksService } from './webhooks.service';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Webhooks')
@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AsaasWebhookGuard)
  @ApiOperation({
    summary: 'Recebe os eventos e notificações de pagamento do Asaas',
  })
  @ApiResponse({ status: 200, description: 'Evento processado com sucesso' })
  @ApiResponse({ status: 401, description: 'Token de webhook inválido' })
  async handleAsaasWebhook(@Body() payload: AsaasWebhookDto) {
    const { event, payment, id: eventId } = payload || {};
    if (!payment?.id) {
      return { received: true };
    }
    return this.webhooksService.handleAsaasEvent(
      event,
      payment,
      eventId,
      payload,
    );
  }
}
