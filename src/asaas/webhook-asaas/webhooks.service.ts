import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from '../asaas.service';
import { ApptStatus, TransactionStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MailService } from 'src/modules/mail/mail.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Processa eventos recebidos via webhook do Asaas com idempotência,
   * validação estrita de valores, máquina de estados e proteção contra estorno/chargeback.
   */

  async handleAsaasEvent(
    event: string,
    payment: any,
    eventId?: string,
    rawPayload?: any,
  ) {
    try {
      if (!payment?.id) {
        return { received: true, ignored: true, reason: 'Missing payment.id' };
      }

      const correlationId = `evt_${Date.now()}_${payment.id}`;
      const eventKey =
        eventId ||
        `${event}_${payment.id}_${payment.status || ''}_${payment.value || ''}`;

      // 1. Idempotência: Checa se o evento já foi processado anteriormente
      try {
        const existingEvent = await this.prisma.webhookEvent.findUnique({
          where: { eventId: eventKey },
        });

        if (existingEvent) {
          this.logger.log(
            `[Webhook Asaas][${correlationId}] Evento ${eventKey} já processado anteriormente (idempotência).`,
          );
          return {
            received: true,
            alreadyProcessed: true,
            event,
            paymentId: payment.id,
          };
        }
      } catch (error: any) {
        this.logger.error(
          `[Webhook Asaas][${correlationId}] Falha ao verificar idempotência: ${error.message}`,
        );
      }

      // 2. Busca da Transação associada
      const transaction = await this.prisma.transaction.findUnique({
        where: { asaasPaymentId: payment.id },
      });

      if (!transaction || !transaction.appointmentId) {
        this.logger.warn(
          `[Webhook Asaas][${correlationId}] Transação/Agendamento não encontrado para o pagamento ${payment.id}.`,
        );
        await this.recordWebhookEvent(
          eventKey,
          event,
          payment.id,
          rawPayload || payment,
        );
        return {
          received: true,
          event,
          paymentId: payment.id,
          warning: 'Transaction not found',
        };
      }

      // 3. Busca do Agendamento associado
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: transaction.appointmentId },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
          company: {
            select: { id: true, businessName: true, timezone: true },
          },
          service: {
            select: { id: true, name: true },
          },
        },
      });

      if (!appointment) {
        this.logger.warn(
          `[Webhook Asaas][${correlationId}] Agendamento #${transaction.appointmentId} não encontrado para a transação ${transaction.id}.`,
        );
        await this.recordWebhookEvent(
          eventKey,
          event,
          payment.id,
          rawPayload || payment,
        );
        return {
          received: true,
          event,
          paymentId: payment.id,
          warning: 'Appointment not found',
        };
      }

      // 4. Roteamento e Máquina de Estados de Eventos
      switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED': {
          // Idempotency: Prevent reversion of REFUNDED or CANCELED transactions
          if (
            transaction.status === TransactionStatus.REFUNDED ||
            transaction.status === TransactionStatus.CANCELED
          ) {
            this.logger.warn(
              `[Webhook Asaas][${correlationId}] Ignorando CONFIRMED em pagamento já ${transaction.status}.`,
            );
            return {
              received: true,
              event,
              paymentId: payment.id,
              ignored: true,
              reason: `Transaction already ${transaction.status}`,
            };
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
              `[Webhook Asaas][${correlationId}] Pagamento ${payment.id} recebido para agendamento expirado/cancelado #${appointment.id}. Disparando estorno automático...`,
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

            await this.recordWebhookEvent(
              eventKey,
              event,
              payment.id,
              rawPayload || payment,
            );

            this.logger.log(
              `[Webhook Asaas][${correlationId}] Estorno automático concluído com sucesso para o pagamento ${payment.id}.`,
            );
            return {
              received: true,
              event,
              paymentId: payment.id,
              status: 'REFUNDED',
            };
          }

          // 2. Conferência Estrita de Valor (Anti-Fraude de Pagamento Menor)
          if (payment.value !== undefined && payment.value !== null) {
            const paidValue = Number(payment.value);
            const expectedValue = Number(transaction.totalValue);

            if (paidValue < expectedValue - 0.01) {
              this.logger.error(
                `[Webhook Asaas][${correlationId}] DIVERGÊNCIA DE VALOR DETECTADA! Esperado: R$ ${expectedValue.toFixed(2)}, Recebido: R$ ${paidValue.toFixed(2)}. Estornando por segurança...`,
              );

              await this.asaasService.refundPayment(
                payment.id,
                undefined,
                'Estorno de segurança: valor pago inferior ao valor total do agendamento.',
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

              await this.recordWebhookEvent(
                eventKey,
                event,
                payment.id,
                rawPayload || payment,
              );

              return {
                received: true,
                event,
                paymentId: payment.id,
                error: 'Value mismatch - refunded',
              };
            }
          }

          // Extrair a taxa real do Asaas liquidada no webhook
          const realAsaasFee =
            payment?.fee !== undefined && payment?.fee !== null
              ? Number(payment.fee)
              : payment?.value !== undefined && payment?.netValue !== undefined
                ? Number(
                    (Number(payment.value) - Number(payment.netValue)).toFixed(
                      2,
                    ),
                  )
                : undefined;

          // Fluxo regular: Confirmação atômica de agendamento e transação
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: TransactionStatus.CONFIRMED,
                ...(realAsaasFee !== undefined &&
                !isNaN(realAsaasFee) &&
                realAsaasFee >= 0
                  ? { asaasFee: realAsaasFee }
                  : {}),
              },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: ApptStatus.CONFIRMED },
            }),
          ]);

          await this.recordWebhookEvent(
            eventKey,
            event,
            payment.id,
            rawPayload || payment,
          );

          this.logger.log(
            `[Webhook Asaas][${correlationId}] Pagamento ${payment.id} CONFIRMADO. Agendamento #${transaction.appointmentId} atualizado para CONFIRMED.${realAsaasFee !== undefined ? ` Taxa Asaas liquidada: R$ ${realAsaasFee.toFixed(2)}.` : ''}`,
          );

          // Disparo resiliente de e-mail de confirmação de agendamento
          if (appointment.client?.email) {
            this.mailService
              .sendAppointmentConfirmationEmail(appointment.client.email, {
                customerName: appointment.client.name,
                companyName:
                  appointment.company?.businessName || 'Estabelecimento',
                serviceName: appointment.service?.name || 'Serviço',
                appointmentDate: appointment.appointmentDate,
                amountPaid: transaction.totalValue,
                timezone: appointment.company?.timezone,
              })
              .catch((err) => {
                this.logger.error(
                  `[Webhook Asaas] Falha ao enviar e-mail de confirmação para ${appointment.client.email}: ${err?.message || err}`,
                );
              });
          }

          break;
        }

        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_DELETED': {
          // Máquina de Estados: Se o agendamento já foi CONFIRMADO ou COMPLETED, não cancela por evento assíncrono atrasado
          if (
            appointment.status === ApptStatus.CONFIRMED ||
            appointment.status === ApptStatus.COMPLETED
          ) {
            this.logger.warn(
              `[Webhook Asaas][${correlationId}] Ignorando cancelamento do pagamento ${payment.id} pois o agendamento #${appointment.id} já está ${appointment.status}.`,
            );
            await this.recordWebhookEvent(
              eventKey,
              event,
              payment.id,
              rawPayload || payment,
            );
            return {
              received: true,
              event,
              paymentId: payment.id,
              ignored: true,
              reason: `Appointment is already ${appointment.status}`,
            };
          }

          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status:
                  event === 'PAYMENT_OVERDUE'
                    ? TransactionStatus.OVERDUE
                    : TransactionStatus.CANCELED,
              },
            }),
            this.prisma.appointment.update({
              where: { id: transaction.appointmentId },
              data: { status: ApptStatus.CANCELED, isActive: false },
            }),
          ]);

          await this.recordWebhookEvent(
            eventKey,
            event,
            payment.id,
            rawPayload || payment,
          );

          this.logger.log(
            `[Webhook Asaas][${correlationId}] Pagamento ${payment.id} ${event}. Agendamento #${transaction.appointmentId} cancelado.`,
          );
          break;
        }

        case 'PAYMENT_REFUNDED': {
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: TransactionStatus.REFUNDED },
            }),
            ...(appointment.status !== ApptStatus.COMPLETED
              ? [
                  this.prisma.appointment.update({
                    where: { id: transaction.appointmentId },
                    data: { status: ApptStatus.CANCELED, isActive: false },
                  }),
                ]
              : []),
          ]);

          await this.recordWebhookEvent(
            eventKey,
            event,
            payment.id,
            rawPayload || payment,
          );

          this.logger.log(
            `[Webhook Asaas][${correlationId}] Pagamento ${payment.id} REEMBOLSADO. Transação marcada como REFUNDED.`,
          );

          // Disparo resiliente de e-mail de cancelamento com estorno
          if (appointment.client?.email) {
            this.mailService
              .sendAppointmentCancellationEmail(appointment.client.email, {
                customerName: appointment.client.name,
                companyName:
                  appointment.company?.businessName || 'Estabelecimento',
                serviceName: appointment.service?.name || 'Serviço',
                appointmentDate: appointment.appointmentDate,
                isRefunded: true,
                timezone: appointment.company?.timezone,
              })
              .catch((err) => {
                this.logger.error(
                  `[Webhook Asaas] Falha ao enviar e-mail de cancelamento/estorno para ${appointment.client.email}: ${err?.message || err}`,
                );
              });
          }

          break;
        }

        case 'PAYMENT_CHARGEBACK_REQUESTED':
        case 'PAYMENT_CHARGEBACK_DISPUTE': {
          this.logger.error(
            `[Webhook Asaas][${correlationId}] ALERTA CRÍTICO: Chargeback/disputa recebida no pagamento ${payment.id} (Agendamento #${transaction.appointmentId}).`,
          );

          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: TransactionStatus.CANCELED },
            }),
            ...(appointment.status !== ApptStatus.COMPLETED
              ? [
                  this.prisma.appointment.update({
                    where: { id: transaction.appointmentId },
                    data: { status: ApptStatus.CANCELED, isActive: false },
                  }),
                ]
              : []),
          ]);

          await this.recordWebhookEvent(
            eventKey,
            event,
            payment.id,
            rawPayload || payment,
          );
          break;
        }

        case 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL':
        case 'PAYMENT_DUNNING_RECEIVED':
        case 'PAYMENT_REFUND_IN_PROGRESS': {
          this.logger.log(
            `[Webhook Asaas][${correlationId}] Notificação financeira recebida (${event}) para o pagamento ${payment.id}.`,
          );
          await this.recordWebhookEvent(
            eventKey,
            event,
            payment.id,
            rawPayload || payment,
          );
          break;
        }

        default:
          this.logger.log(
            `[Webhook Asaas][${correlationId}] Evento ignorado ou não mapeado: ${event}`,
          );
          await this.recordWebhookEvent(
            eventKey,
            event,
            payment.id,
            rawPayload || payment,
          );
      }

      return { received: true, event, paymentId: payment.id };
    } catch (error: any) {
      this.logger.error(
        `[Webhook Asaas] Erro no processamento do evento ${event} (${payment?.id}): ${error.message}`,
      );
      return { received: true, error: error.message };
    }
  }

  /**
   * Salva o evento processado na tabela WebhookEvent para garantia de idempotência e auditoria.
   */
  private async recordWebhookEvent(
    eventId: string,
    event: string,
    paymentId?: string,
    payload?: any,
  ) {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId,
          event,
          paymentId: paymentId || null,
          payload: payload ? payload : undefined,
        },
      });
    } catch (error: any) {
      // Se for duplicata ou erro de persistência, loga e continua sem quebrar o fluxo
      this.logger.debug(
        `[Webhook Asaas] Registro de evento ${eventId} ignorado ou duplicado: ${error.message}`,
      );
    }
  }

  /**
   * Conciliação Ativa: Job executado a cada 30 minutos para consultar pagamentos
   * que permaneceram PENDING e reconciliar com o Asaas em caso de falha de entrega do webhook.
   */
  @Cron(CronExpression.EVERY_30_MINUTES, { timeZone: 'America/Sao_Paulo' })
  async reconcilePendingTransactions(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
        createdAt: {
          lt: fiveMinutesAgo,
          gt: twoDaysAgo,
        },
        asaasPaymentId: { not: null },
      },
      include: {
        appointment: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (pendingTransactions.length === 0) {
      return 0;
    }

    this.logger.log(
      `[Conciliação Ativa] Iniciando reconciliação de ${pendingTransactions.length} transação(ões) pendente(s)...`,
    );

    let reconciledCount = 0;

    for (const tx of pendingTransactions) {
      if (!tx.asaasPaymentId) continue;
      try {
        const asaasPayment = await this.asaasService.getPaymentById(
          tx.asaasPaymentId,
        );
        if (!asaasPayment || !asaasPayment.status) continue;

        if (
          asaasPayment.status === 'RECEIVED' ||
          asaasPayment.status === 'CONFIRMED' ||
          asaasPayment.status === 'RECEIVED_IN_CASH'
        ) {
          this.logger.log(
            `[Conciliação Ativa] Transação #${tx.id} (${tx.asaasPaymentId}) confirmada no Asaas. Reconciliando...`,
          );
          await this.handleAsaasEvent(
            'PAYMENT_CONFIRMED',
            asaasPayment,
            `reconciled_${tx.asaasPaymentId}_${asaasPayment.status}`,
          );
          reconciledCount++;
        } else if (
          asaasPayment.status === 'OVERDUE' ||
          asaasPayment.status === 'REFUNDED'
        ) {
          this.logger.log(
            `[Conciliação Ativa] Transação #${tx.id} (${tx.asaasPaymentId}) ${asaasPayment.status} no Asaas. Reconciliando...`,
          );
          await this.handleAsaasEvent(
            `PAYMENT_${asaasPayment.status}`,
            asaasPayment,
            `reconciled_${tx.asaasPaymentId}_${asaasPayment.status}`,
          );
          reconciledCount++;
        }
      } catch (error: any) {
        this.logger.error(
          `[Conciliação Ativa] Erro ao reconciliar transação #${tx.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `[Conciliação Ativa] Reconciliação concluída. ${reconciledCount} transação(ões) atualizada(s).`,
    );

    return reconciledCount;
  }
}
