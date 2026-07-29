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

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AsaasWebhookGuard)
  @ApiOperation({
    summary: 'Recebe os eventos e notificações de pagamento do Asaas',
  })
  @ApiResponse({ status: 200, description: 'Evento processado com sucesso' })
  @ApiResponse({ status: 401, description: 'Token de webhook inválido' })
  async handleAsaasWebhook(@Body() payload: any) {
    const { event, payment } = payload;
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        // TODO: Aqui a gente atualiza o status do Appointment no Prisma para CONFIRMED
        console.log(
          `Pagamento confirmado para o Pix TxId / Asaas ID: ${payment.id}`,
        );
        break;

      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_DELETED':
        // TODO: Aqui a gente pode cancelar o agendamento pendente se o PIX expirar
        console.log(`Pagamento expirou ou foi cancelado: ${payment.id}`);
        break;

      default:
        console.log(`Evento ignorado: ${event}`);
    }

    // Retorna 200 rápido para o Asaas não achar que sua API caiu
    return { received: true };
  }
}
