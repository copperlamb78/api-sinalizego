import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailOutbox, EmailStatus, EmailTemplateType } from '@prisma/client';
import { MailService } from './mail.service';

export interface EnqueueEmailDto {
  to: string;
  subject: string;
  template: EmailTemplateType;
  payload: Record<string, any>;
  delayMinutes?: number;
  lastError?: string;
}

@Injectable()
export class MailOutboxService {
  private readonly logger = new Logger(MailOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,
  ) {}

  /**
   * Persiste uma notificação de e-mail na tabela EmailOutbox para reprocessamento assíncrono resiliente.
   */
  async enqueueEmail(data: EnqueueEmailDto): Promise<EmailOutbox> {
    const delayMinutes = data.delayMinutes ?? 2;
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    const record = await this.prisma.emailOutbox.create({
      data: {
        to: data.to,
        subject: data.subject,
        template: data.template,
        payload: data.payload,
        status: EmailStatus.PENDING,
        attempts: 1,
        nextRetryAt,
        lastError: data.lastError ?? null,
      },
    });

    this.logger.warn(
      `[MailOutbox] E-mail enfileirado para reprocessamento: #${record.id} [${data.template}] para ${data.to}. Próxima tentativa em ${delayMinutes} min.`,
    );

    return record;
  }

  /**
   * Worker periódico com cadência de 2 minutos para reprocessamento de e-mails pendentes.
   * Utiliza batch frugal de 20 registros com índice composto [status, nextRetryAt].
   */
  @Cron('*/2 * * * *')
  async processPendingEmails(): Promise<number> {
    const now = new Date();
    const pendingList = await this.prisma.emailOutbox.findMany({
      where: {
        status: EmailStatus.PENDING,
        nextRetryAt: { lte: now },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    if (pendingList.length === 0) {
      return 0;
    }

    this.logger.log(
      `[MailOutbox] Processando lote de ${pendingList.length} e-mail(s) pendente(s)...`,
    );

    let processedCount = 0;

    for (const item of pendingList) {
      try {
        const payload = (item.payload as Record<string, any>) || {};
        const success = await this.mailService.dispatchFromOutbox(
          item.template,
          item.to,
          payload,
        );

        if (success) {
          await this.prisma.emailOutbox.update({
            where: { id: item.id },
            data: {
              status: EmailStatus.SENT,
              sentAt: new Date(),
              lastError: null,
            },
          });
          this.logger.log(
            `[MailOutbox] E-mail #${item.id} [${item.template}] entregue com sucesso no reprocessamento para ${item.to}.`,
          );
          processedCount++;
        } else {
          await this.handleFailedAttempt(item, 'Falha no despacho Brevo');
        }
      } catch (err: any) {
        await this.handleFailedAttempt(
          item,
          err?.message || 'Erro inesperado no envio',
        );
      }
    }

    return processedCount;
  }

  /**
   * Incrementa as tentativas e calcula o próximo retry com Backoff Exponencial Progressivo.
   */
  private async handleFailedAttempt(
    item: EmailOutbox,
    errorMessage: string,
  ): Promise<void> {
    const nextAttempts = item.attempts + 1;
    const isDeadLetter = nextAttempts >= item.maxAttempts;

    // Escala de Backoff Exponencial: 2m -> 5m -> 15m -> 30m -> 60m
    const backoffDelays = [2, 5, 15, 30, 60];
    const delayIndex = Math.min(nextAttempts - 1, backoffDelays.length - 1);
    const delayMinutes = backoffDelays[delayIndex];
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    await this.prisma.emailOutbox.update({
      where: { id: item.id },
      data: {
        attempts: nextAttempts,
        status: isDeadLetter ? EmailStatus.FAILED : EmailStatus.PENDING,
        nextRetryAt,
        lastError: errorMessage,
      },
    });

    if (isDeadLetter) {
      this.logger.error(
        `[MailOutbox Dead Letter] E-mail #${item.id} para ${item.to} falhou após ${item.maxAttempts} tentativas. Marcado como FAILED.`,
      );
    } else {
      this.logger.warn(
        `[MailOutbox] E-mail #${item.id} para ${item.to} falhou na tentativa ${nextAttempts}/${item.maxAttempts}. Próximo retry em ${delayMinutes} min.`,
      );
    }
  }

  /**
   * Job diário de expurgo executado às 03:00 da manhã.
   * Remove registros SENT com mais de 7 dias e FAILED com mais de 30 dias para evitar inchaço de disco na VPS.
   */
  @Cron('0 3 * * *')
  async purgeOldEmails(): Promise<{ purgedSent: number; purgedFailed: number }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [deletedSent, deletedFailed] = await Promise.all([
      this.prisma.emailOutbox.deleteMany({
        where: {
          status: EmailStatus.SENT,
          createdAt: { lt: sevenDaysAgo },
        },
      }),
      this.prisma.emailOutbox.deleteMany({
        where: {
          status: EmailStatus.FAILED,
          createdAt: { lt: thirtyDaysAgo },
        },
      }),
    ]);

    if (deletedSent.count > 0 || deletedFailed.count > 0) {
      this.logger.log(
        `[MailOutbox Purge] Limpeza executada: ${deletedSent.count} entregue(s) e ${deletedFailed.count} falho(s) expurgados.`,
      );
    }

    return {
      purgedSent: deletedSent.count,
      purgedFailed: deletedFailed.count,
    };
  }
}
