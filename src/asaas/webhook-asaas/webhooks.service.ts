import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from '../asaas.service';
import {
  ApptStatus,
  PlatformInvoiceStatus,
  TransactionStatus,
} from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BARBER_ASAAS_PIX_FEE } from 'src/common/constants/billing.constant';

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

      // 1. Idempotência Atômica: Gravação antecipada no início usando unique constraint como lock (A13)
      let isDuplicate = false;
      try {
        await this.prisma.webhookEvent.create({
          data: {
            eventId: eventKey,
            event: event,
            paymentId: payment.id,
            payload: rawPayload || payment,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          isDuplicate = true;
        } else {
          this.logger.error(
            `[Webhook Asaas][${correlationId}] Falha ao registrar idempotência atômica: ${err.message}`,
          );
        }
      }

      if (isDuplicate) {
        this.logger.log(
          `[Webhook Asaas][${correlationId}] Evento ${eventKey} já processado anteriormente (idempotência atômica).`,
        );
        return {
          received: true,
          alreadyProcessed: true,
          event,
          paymentId: payment.id,
        };
      }

      // 2. Busca da Transação associada
      const transaction = await this.prisma.transaction.findUnique({
        where: { asaasPaymentId: payment.id },
      });

      if (!transaction || !transaction.appointmentId) {
        this.logger.warn(
          `[Webhook Asaas][${correlationId}] Transação/Agendamento não encontrado para o pagamento ${payment.id}.`,
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
          // Idempotência / Máquina de Estados: Impede reverter transações já liquidadas/canceladas (A12)
          if (
            transaction.status === TransactionStatus.REFUNDED ||
            transaction.status === TransactionStatus.CANCELED
          ) {
            this.logger.warn(
              `[Webhook Asaas][${correlationId}] Ignorando ${event} em pagamento já ${transaction.status}.`,
            );
            return {
              received: true,
              event,
              paymentId: payment.id,
              ignored: true,
              reason: `Transaction already ${transaction.status}`,
            };
          }

          // Revalidação com a API Asaas (A11 / A20)
          let verifiedPayment = payment;
          try {
            const remotePayment = await this.asaasService.getPaymentById(
              payment.id,
            );
            if (remotePayment && remotePayment.id) {
              verifiedPayment = remotePayment;
              this.logger.log(
                `[Webhook Asaas][${correlationId}] Pagamento ${payment.id} revalidado com sucesso na API Asaas (status: ${remotePayment.status}, valor: ${remotePayment.value}).`,
              );
            }
          } catch (revalErr: any) {
            this.logger.warn(
              `[Webhook Asaas][${correlationId}] Revalidação via API Asaas falhou (${revalErr?.message || revalErr}). Prosseguindo com dados do payload.`,
            );
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
          if (
            verifiedPayment.value !== undefined &&
            verifiedPayment.value !== null
          ) {
            const paidValue = Number(verifiedPayment.value);
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
            verifiedPayment?.fee !== undefined && verifiedPayment?.fee !== null
              ? Number(verifiedPayment.fee)
              : verifiedPayment?.value !== undefined &&
                  verifiedPayment?.netValue !== undefined
                ? Number(
                    (
                      Number(verifiedPayment.value) -
                      Number(verifiedPayment.netValue)
                    ).toFixed(2),
                  )
                : undefined;

          const platformAbsorbedFee =
            realAsaasFee !== undefined &&
            !isNaN(realAsaasFee) &&
            realAsaasFee > BARBER_ASAAS_PIX_FEE
              ? Number((realAsaasFee - BARBER_ASAAS_PIX_FEE).toFixed(2))
              : 0;

          if (
            realAsaasFee !== undefined &&
            realAsaasFee > BARBER_ASAAS_PIX_FEE
          ) {
            this.logger.warn(
              `[MARGEM][${correlationId}] Tarifa Asaas real R$ ${realAsaasFee.toFixed(2)} excede a parte fixa do barbeiro (R$ ${BARBER_ASAAS_PIX_FEE.toFixed(2)}). Plataforma absorvendo R$ ${platformAbsorbedFee.toFixed(2)} em ${payment.id}.`,
            );
          }

          // Fluxo regular: Confirmação atômica de agendamento e transação
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: TransactionStatus.CONFIRMED,
                ...(realAsaasFee !== undefined &&
                !isNaN(realAsaasFee) &&
                realAsaasFee >= 0
                  ? {
                      asaasFee: realAsaasFee,
                      platformAbsorbedFee: platformAbsorbedFee,
                    }
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
            `[Webhook Asaas][${correlationId}] Pagamento ${payment.id} CONFIRMADO. Agendamento #${transaction.appointmentId} atualizado para CONFIRMED.${realAsaasFee !== undefined ? ` Taxa Asaas liquidada: R$ ${realAsaasFee.toFixed(2)} (absorvida: R$ ${platformAbsorbedFee.toFixed(2)}).` : ''}`,
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

        case 'PAYMENT_RECEIVED_IN_CASH': {
          // Refinamento de Segurança: Pagamento presencial em dinheiro não transita pelo gateway.
          // O agendamento é confirmado, mas o split eletrônico é zerado para evitar provisionamento indevido de saldo sacável.
          await this.prisma.$transaction([
            this.prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: TransactionStatus.CONFIRMED,
                netValue: 0,
                platformFee: 0,
                asaasFee: 0,
                platformAbsorbedFee: 0,
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
            `[Webhook Asaas][${correlationId}] Pagamento em dinheiro (${payment.id}) recebido presencialmente. Agendamento #${transaction.appointmentId} confirmado. Split financeiro eletrônico ignorado.`,
          );

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

    const totalPendingCount = await this.prisma.transaction.count({
      where: {
        status: TransactionStatus.PENDING,
        createdAt: {
          lt: fiveMinutesAgo,
          gt: twoDaysAgo,
        },
        asaasPaymentId: { not: null },
      },
    });

    if (totalPendingCount === 0) {
      return 0;
    }

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

    this.logger.log(
      `[Conciliação Ativa] Processando ${pendingTransactions.length} de ${totalPendingCount} transações pendentes no backlog...`,
    );

    if (totalPendingCount > pendingTransactions.length) {
      this.logger.warn(
        `[Conciliação Ativa] Backlog com ${totalPendingCount - pendingTransactions.length} transações remanescentes que serão processadas nos próximos ciclos.`,
      );
    }

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

  /**
   * Processa webhooks de notas fiscais (INVOICE_*) recebidos do Asaas.
   */
  async handleInvoiceEvent(
    event: string,
    invoice: any,
    eventId?: string,
    rawPayload?: any,
  ) {
    try {
      if (!invoice?.id) {
        return { received: true, ignored: true, reason: 'Missing invoice.id' };
      }

      const correlationId = `inv_evt_${Date.now()}_${invoice.id}`;
      const eventKey =
        eventId || `${event}_${invoice.id}_${invoice.status || ''}`;

      // 1. Idempotência Atômica via WebhookEvent
      let isDuplicate = false;
      try {
        await this.prisma.webhookEvent.create({
          data: {
            eventId: eventKey,
            event: event,
            paymentId: invoice.id,
            payload: rawPayload || invoice,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          isDuplicate = true;
        } else {
          this.logger.error(
            `[Webhook Asaas][${correlationId}] Falha ao registrar idempotência atômica da NFS-e: ${err.message}`,
          );
        }
      }

      if (isDuplicate) {
        this.logger.log(
          `[Webhook Asaas][${correlationId}] Evento de NFS-e ${eventKey} já processado anteriormente.`,
        );
        return {
          received: true,
          alreadyProcessed: true,
          event,
          invoiceId: invoice.id,
        };
      }

      // 2. Localiza a PlatformInvoice correspondente
      const platformInvoice = await this.prisma.platformInvoice.findFirst({
        where: {
          OR: [
            { asaasInvoiceId: invoice.id },
            ...(invoice.externalReference
              ? [{ id: invoice.externalReference }]
              : []),
          ],
        },
        include: {
          company: {
            select: { id: true, businessName: true },
          },
        },
      });

      if (!platformInvoice) {
        this.logger.warn(
          `[Webhook Asaas][${correlationId}] PlatformInvoice não encontrada para a nota Asaas #${invoice.id}.`,
        );
        return {
          received: true,
          event,
          invoiceId: invoice.id,
          warning: 'PlatformInvoice not found',
        };
      }

      // 3. Mapeamento e atualização de status
      const updateData: any = {
        pdfUrl: invoice.pdfUrl || platformInvoice.pdfUrl,
        xmlUrl: invoice.xmlUrl || platformInvoice.xmlUrl,
        invoiceNumber: invoice.number || platformInvoice.invoiceNumber,
      };

      if (!platformInvoice.asaasInvoiceId) {
        updateData.asaasInvoiceId = invoice.id;
      }

      switch (event) {
        case 'INVOICE_AUTHORIZED':
          updateData.status = PlatformInvoiceStatus.AUTHORIZED;
          updateData.authorizedAt = new Date();
          updateData.errorMessage = null;
          this.logger.log(
            `[Webhook Asaas][${correlationId}] NFS-e #${platformInvoice.id} autorizada com sucesso pela prefeitura! Número: ${invoice.number}`,
          );
          break;

        case 'INVOICE_SYNCHRONIZED':
          updateData.status = PlatformInvoiceStatus.SYNCHRONIZED;
          break;

        case 'INVOICE_ERROR': {
          updateData.status = PlatformInvoiceStatus.ERROR;
          updateData.errorMessage =
            invoice.statusDescription ||
            rawPayload?.statusDescription ||
            'Erro na autorização da nota fiscal junto à prefeitura.';

          this.logger.error(
            `[Webhook Asaas][${correlationId}] Erro na autorização da NFS-e #${platformInvoice.id}: ${updateData.errorMessage}`,
          );

          // Disparo de e-mail de alerta ao administrador
          const adminEmail =
            process.env.ADMIN_ALERT_EMAIL ||
            process.env.MAIL_FROM_EMAIL ||
            'admin@sinalizego.com';

          await this.mailService
            .sendInvoiceErrorAlertEmail(adminEmail, {
              invoiceId: platformInvoice.id,
              companyName: platformInvoice.company.businessName,
              companyId: platformInvoice.company.id,
              competence: `${String(platformInvoice.periodMonth).padStart(2, '0')}/${platformInvoice.periodYear}`,
              grossAmount: Number(platformInvoice.grossAmount),
              errorMessage: updateData.errorMessage,
            })
            .catch((mailErr) => {
              this.logger.warn(
                `[Webhook Asaas][${correlationId}] Falha ao enviar e-mail de alerta de erro de NFS-e: ${mailErr?.message || mailErr}`,
              );
            });
          break;
        }

        case 'INVOICE_CANCELED':
          updateData.status = PlatformInvoiceStatus.CANCELED;
          break;

        case 'INVOICE_CANCELLATION_DENIED':
          updateData.status = PlatformInvoiceStatus.CANCELLATION_DENIED;
          break;

        case 'INVOICE_PROCESSING_CANCELLATION':
          updateData.status = PlatformInvoiceStatus.PROCESSING_CANCELLATION;
          break;

        default:
          if (
            invoice.status &&
            PlatformInvoiceStatus[invoice.status as PlatformInvoiceStatus]
          ) {
            updateData.status = invoice.status as PlatformInvoiceStatus;
          }
          break;
      }

      await this.prisma.platformInvoice.update({
        where: { id: platformInvoice.id },
        data: updateData,
      });

      return {
        received: true,
        event,
        invoiceId: invoice.id,
        platformInvoiceId: platformInvoice.id,
        status: updateData.status,
      };
    } catch (err: any) {
      this.logger.error(
        `[Webhook Asaas] Erro ao processar evento de NFS-e: ${err?.message || err}`,
        err?.stack,
      );
      // Regra A21: Webhook NUNCA pode responder >= 500
      return {
        received: true,
        error: true,
        message: 'Processed with error recovery',
      };
    }
  }

  /**
   * Rotina diária às 03:00 UTC para purga de eventos de webhook antigos (> 60 dias) (O-22).
   */
  @Cron('0 3 * * *', { timeZone: 'UTC' })
  async purgeOldWebhookEvents() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    const deleted = await this.prisma.webhookEvent.deleteMany({
      where: {
        processedAt: { lt: cutoffDate },
      },
    });

    if (deleted.count > 0) {
      this.logger.log(
        `[Webhook Cleanup] Purgados ${deleted.count} eventos de webhook anteriores a ${cutoffDate.toISOString()}.`,
      );
    }

    return deleted.count;
  }
}
