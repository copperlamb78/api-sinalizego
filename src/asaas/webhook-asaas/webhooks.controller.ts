import { AsaasWebhookDto } from './dto/asaas-webhook.dto';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AsaasWebhookGuard } from './guard/asaas-webhook.guard';
import { WebhooksService } from './webhooks.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Webhooks')
@Throttle({ default: { limit: 1000, ttl: 60000 } })
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

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
    try {
      const { event, payment, invoice, id: eventId } = payload || {};

      if (event?.startsWith('INVOICE_')) {
        if (!invoice?.id) {
          return {
            received: true,
            ignored: true,
            reason: 'Missing invoice.id',
          };
        }
        return await this.webhooksService.handleInvoiceEvent(
          event,
          invoice,
          eventId,
          payload,
        );
      }

      if (!payment?.id) {
        return { received: true };
      }
      return await this.webhooksService.handleAsaasEvent(
        event,
        payment,
        eventId,
        payload,
      );
    } catch (err: any) {
      // Regra Crítica A21: Webhooks sequenciais NUNCA podem responder >= 500
      this.logger.error(
        `[Webhook Controller] Erro não tratado ao processar webhook do Asaas: ${err?.message || err}`,
        err?.stack,
      );
      return {
        received: true,
        error: true,
        message: 'Processed with error recovery',
      };
    }
  }
}
