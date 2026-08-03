//crie a base do service de webhooks do asaas
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async handleAsaasEvent(event: string, payment: any) {
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        const transaction = await this.prisma.transaction.findUnique({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction && transaction.appointmentId) {
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'CONFIRMED' },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: 'CONFIRMED' },
            }),
          ]);
          console.log(
            `[Webhook Asaas] Pagamento ${payment.id} CONFIRMADO. Agendamento ${transaction.appointmentId} atualizado para CONFIRMED.`,
          );
        }
        break;
      }

      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_DELETED': {
        const transaction = await this.prisma.transaction.findUnique({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction && transaction.appointmentId) {
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'CANCELED' },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: 'CANCELED' },
            }),
          ]);
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
