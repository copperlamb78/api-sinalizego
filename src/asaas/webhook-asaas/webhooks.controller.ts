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

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

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
    if (!payment?.id) {
      return { received: true };
    }

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        const transaction = await this.prisma.transaction.findFirst({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction) {
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'CONFIRMED' },
          });

          await this.prisma.appointment.update({
            where: { id: transaction.appointmentId },
            data: { status: 'CONFIRMED' },
          });
          console.log(
            `[Webhook Asaas] Pagamento ${payment.id} CONFIRMADO. Agendamento ${transaction.appointmentId} atualizado para CONFIRMED.`,
          );
        }
        break;
      }

      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_DELETED': {
        const transaction = await this.prisma.transaction.findFirst({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction) {
          await this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'CANCELED' },
          });

          await this.prisma.appointment.update({
            where: { id: transaction.appointmentId },
            data: { status: 'CANCELED' },
          });
          console.log(
            `[Webhook Asaas] Pagamento ${payment.id} CANCELADO/EXPIRADO. Agendamento ${transaction.appointmentId} cancelado.`,
          );
        }
        break;
      }

      default:
        console.log(`[Webhook Asaas] Evento ignorado: ${event}`);
    }

    return { received: true, event, paymentId: payment.id };
  }
}
