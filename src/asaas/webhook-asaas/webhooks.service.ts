import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from '../asaas.service';
import { ApptStatus, TransactionStatus } from '@prisma/client';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  async handleAsaasEvent(event: string, payment: any) {
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        const transaction = await this.prisma.transaction.findUnique({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction && transaction.appointmentId) {
          const appointment = await this.prisma.appointment.findUnique({
            where: { id: transaction.appointmentId },
          });

          if (!appointment) {
            this.logger.warn(
              `[Webhook Asaas] Agendamento ${transaction.appointmentId} não encontrado para a transação ${transaction.id}.`,
            );
            break;
          }

          // Salvaguarda Anti-Race Condition: Se o agendamento já foi cancelado ou expirou antes do pagamento
          const isExpired =
            appointment.expiresAt && appointment.expiresAt < new Date();
          if (
            appointment.status === ApptStatus.CANCELED ||
            !appointment.isActive ||
            (appointment.status === ApptStatus.PENDING_PAYMENT && isExpired)
          ) {
            this.logger.warn(
              `[Webhook Asaas] Pagamento ${payment.id} recebido para agendamento expirado/cancelado #${appointment.id}. Disparando estorno automático...`,
            );

            await this.asaasService.refundPayment(
              payment.id,
              undefined,
              'Estorno automático: agendamento expirado antes da confirmação do pagamento.',
            );

            await this.prisma.$transaction([
              this.prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: TransactionStatus.REFUNDED },
              }),
              this.prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: ApptStatus.CANCELED, isActive: false },
              }),
            ]);

            this.logger.log(
              `[Webhook Asaas] Estorno automático concluído com sucesso para o pagamento ${payment.id}.`,
            );
            break;
          }

          // Fluxo regular: Confirma agendamento e transação
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: TransactionStatus.CONFIRMED },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: ApptStatus.CONFIRMED },
            }),
          ]);

          this.logger.log(
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
              data: { status: TransactionStatus.CANCELED },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: ApptStatus.CANCELED, isActive: false },
            }),
          ]);

          this.logger.log(
            `[Webhook Asaas] Pagamento ${payment.id} CANCELADO/EXPIRADO. Agendamento ${transaction.appointmentId} cancelado.`,
          );
        }
        break;
      }

      case 'PAYMENT_REFUNDED': {
        const transaction = await this.prisma.transaction.findUnique({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction && transaction.appointmentId) {
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: TransactionStatus.REFUNDED },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: ApptStatus.CANCELED, isActive: false },
            }),
          ]);

          this.logger.log(
            `[Webhook Asaas] Pagamento ${payment.id} REEMBOLSADO. Agendamento ${transaction.appointmentId} cancelado.`,
          );
        }
        break;
      }

      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE': {
        const transaction = await this.prisma.transaction.findUnique({
          where: { asaasPaymentId: payment.id },
        });

        if (transaction && transaction.appointmentId) {
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: TransactionStatus.CANCELED },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: ApptStatus.CANCELED, isActive: false },
            }),
          ]);

          this.logger.warn(
            `[Webhook Asaas] Chargeback/disputa recebida no pagamento ${payment.id}. Agendamento ${transaction.appointmentId} cancelado.`,
          );
        }
        break;
      }

      default:
        this.logger.log(`[Webhook Asaas] Evento ignorado: ${event}`);
    }

    return { received: true, event, paymentId: payment.id };
  }
}
