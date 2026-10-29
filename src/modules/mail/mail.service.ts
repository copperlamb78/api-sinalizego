import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import { EmailTemplateType } from '@prisma/client';
import { MailOutboxService } from './mail-outbox.service';
import {
  formatAppointmentDateTime,
  getAppointmentCancellationEmailTemplate,
  getAppointmentConfirmationEmailTemplate,
  getAppointmentReminderEmailTemplate,
  getInvoiceErrorAlertEmailTemplate,
  getPasswordResetEmailTemplate,
  getTemporaryPasswordEmailTemplate,
  getWelcomeEmailTemplate,
  getOwnerUnavailabilityEmailTemplate,
} from './templates/email.templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly brevoClient: BrevoClient;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => MailOutboxService))
    private readonly mailOutboxService: MailOutboxService,
  ) {
    const apiKey =
      this.configService.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY ||
      '';
    this.brevoClient = new BrevoClient({ apiKey });

    this.senderEmail =
      this.configService.get<string>('MAIL_FROM_EMAIL') ||
      process.env.MAIL_FROM_EMAIL ||
      'sinalizego@gmail.com';
    this.senderName =
      this.configService.get<string>('MAIL_FROM_NAME') ||
      process.env.MAIL_FROM_NAME ||
      'SinalizeGo';
  }

  /**
   * Identifica se o erro retornado pela API do Brevo é um 401 por IP não autorizado (Whitelist).
   */
  private isBrevoUnauthorizedIpError(error: any): boolean {
    const errorString = `${error?.message || ''} ${error?.body || ''} ${JSON.stringify(error || '')}`.toLowerCase();
    const is401 =
      error?.status === 401 ||
      error?.statusCode === 401 ||
      error?.response?.status === 401;
    return (
      is401 ||
      errorString.includes('unrecognised ip') ||
      errorString.includes('authorised_ips')
    );
  }

  /**
   * Emite alerta formatado no terminal quando o IP não está autorizado no Brevo.
   */
  private logBrevoIpWarning(error: any, to: string, subject: string): void {
    const isDev =
      this.configService.get<string>('NODE_ENV') === 'development' ||
      process.env.NODE_ENV === 'development';

    this.logger.warn(`
+--------------------------------------------------------------------------------------------------+
| [BREVO SECURITY] IP NAO AUTORIZADO DETECTADO                                                     |
| E-mail de destino: ${to}
| Assunto: ${subject}
| Mensagem da API: ${error?.message || error?.body?.message || 'We have detected you are using an unrecognised IP address'}
| Acao necessaria: Adicione seu IP publico no painel de seguranca do Brevo:                        |
| https://app.brevo.com/security/authorised_ips                                                    |
+--------------------------------------------------------------------------------------------------+`);

    if (isDev) {
      this.logger.log(
        `[MailService DEV SIMULATION] E-mail persistido no outbox para reenvio automatico assim que o IP for liberado.`,
      );
    }
  }

  /**
   * Executa envio com micro-retry em memória (curto backoff exponencial) para falhas transitórias.
   * Aplica Fail-Fast imediato para erros 401 ou 400.
   */
  private async executeWithMicroRetry(
    sendFn: () => Promise<any>,
    to: string,
    subject: string,
  ): Promise<{ success: boolean; lastError?: any; isIpUnauthorized?: boolean }> {
    const maxAttempts = 3;
    const delaysMs = [1000, 3000];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await sendFn();
        if (attempt > 1) {
          this.logger.log(
            `[MailService] E-mail enviado com sucesso após recuperação na tentativa ${attempt}.`,
          );
        }
        return { success: true };
      } catch (error: any) {
        const isIpUnauthorized = this.isBrevoUnauthorizedIpError(error);

        if (isIpUnauthorized) {
          this.logBrevoIpWarning(error, to, subject);
          return { success: false, lastError: error, isIpUnauthorized: true };
        }

        const statusCode =
          error?.status || error?.statusCode || error?.response?.status;
        const isClientError =
          statusCode >= 400 && statusCode < 500 && statusCode !== 429;

        if (isClientError || attempt === maxAttempts) {
          this.logger.error(
            `Falha ao enviar "${subject}" para ${to}: ${error?.message || error}`,
          );
          return { success: false, lastError: error };
        }

        const delay = delaysMs[attempt - 1] || 1000;
        this.logger.warn(
          `[MailService] Erro transitório ao enviar para ${to} (tentativa ${attempt}/${maxAttempts}). Retentando em ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { success: false };
  }

  /**
   * Enfileira o e-mail no outbox caso o envio síncrono falhe, assegurando tolerância a falhas.
   */
  private async enqueueFallback(
    to: string,
    subject: string,
    template: EmailTemplateType,
    payload: Record<string, any>,
    result: { success: boolean; lastError?: any; isIpUnauthorized?: boolean },
  ): Promise<void> {
    if (this.mailOutboxService?.enqueueEmail) {
      await this.mailOutboxService
        .enqueueEmail({
          to,
          subject,
          template,
          payload,
          delayMinutes: result.isIpUnauthorized ? 5 : 2,
          lastError: String(
            result.lastError?.message ||
              result.lastError ||
              'Falha no envio direto',
          ),
        })
        .catch((err) => {
          this.logger.error(
            `[MailService] Falha ao persistir no outbox: ${err?.message || err}`,
          );
        });
    }
  }

  /**
   * Envia e-mail de boas-vindas para novos usuários cadastrados.
   */
  async sendWelcomeEmail(
    to: string,
    name: string,
    role?: string,
  ): Promise<boolean> {
    const subject = 'Boas-vindas ao SinalizeGo!';
    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: name || to }],
        htmlContent: getWelcomeEmailTemplate(name, role),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(`E-mail de boas-vindas enviado com sucesso para ${to}`);
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.WELCOME,
      { name, role },
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de confirmação de agendamento após aprovação do pagamento.
   */
  async sendAppointmentConfirmationEmail(
    to: string,
    data: {
      customerName: string;
      companyName: string;
      serviceName: string;
      appointmentDate: Date | string;
      amountPaid: number | string | { toString(): string };
      appointmentId?: string;
      timezone?: string;
      paymentMethod?: string;
    },
  ): Promise<boolean> {
    const subject = `Agendamento Confirmado — ${data.companyName}`;
    const formattedDate = formatAppointmentDateTime(
      data.appointmentDate,
      data.timezone || 'America/Sao_Paulo',
    );
    const paidFormatted = Number(
      data.amountPaid?.toString?.() ?? data.amountPaid,
    ).toFixed(2);

    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: data.customerName || to }],
        htmlContent: getAppointmentConfirmationEmailTemplate({
          appointmentId: data.appointmentId,
          customerName: data.customerName,
          companyName: data.companyName,
          serviceName: data.serviceName,
          formattedDate,
          amountPaid: paidFormatted,
          paymentMethod: data.paymentMethod || 'Pix',
        }),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `E-mail de confirmação de agendamento enviado com sucesso para ${to}`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.APPOINTMENT_CONFIRMATION,
      data,
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de cancelamento de agendamento (com ou sem estorno).
   */
  async sendAppointmentCancellationEmail(
    to: string,
    data: {
      customerName: string;
      companyName: string;
      serviceName: string;
      appointmentDate: Date | string;
      isRefunded: boolean;
      refundAmount?: number;
      policy?: 'REFUND' | 'CREDIT' | 'RETAINED';
      timezone?: string;
    },
  ): Promise<boolean> {
    const subject = `Agendamento Cancelado — ${data.companyName}`;
    const formattedDate = formatAppointmentDateTime(
      data.appointmentDate,
      data.timezone || 'America/Sao_Paulo',
    );

    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: data.customerName || to }],
        htmlContent: getAppointmentCancellationEmailTemplate({
          customerName: data.customerName,
          companyName: data.companyName,
          serviceName: data.serviceName,
          formattedDate,
          isRefunded: data.isRefunded,
          refundAmount: data.refundAmount,
          policy: data.policy,
        }),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `E-mail de cancelamento de agendamento enviado com sucesso para ${to}`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.APPOINTMENT_CANCELLATION,
      data,
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de notificação de imprevisto do estabelecimento com link mágico para reagendamento e crédito.
   */
  async sendOwnerUnavailabilityRescheduleEmail(
    to: string,
    data: {
      customerName: string;
      companyName: string;
      serviceName: string;
      appointmentDate: Date | string;
      creditAmount: number;
      rescheduleUrl: string;
      timezone?: string;
    },
  ): Promise<boolean> {
    const subject = `Imprevisto no Horário — Seu sinal virou crédito em ${data.companyName}`;
    const formattedDate = formatAppointmentDateTime(
      data.appointmentDate,
      data.timezone || 'America/Sao_Paulo',
    );

    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: data.customerName || to }],
        htmlContent: getOwnerUnavailabilityEmailTemplate({
          customerName: data.customerName,
          companyName: data.companyName,
          serviceName: data.serviceName,
          formattedDate,
          creditAmount: data.creditAmount,
          rescheduleUrl: data.rescheduleUrl,
        }),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `E-mail de imprevisto e reagendamento enviado com sucesso para ${to}`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.OWNER_UNAVAILABILITY,
      data,
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de lembrete de véspera (D-1).
   */
  async sendAppointmentReminderEmail(
    to: string,
    data: {
      customerName: string;
      companyName: string;
      serviceName: string;
      appointmentDate: Date | string;
      address?: string;
      timezone?: string;
    },
  ): Promise<boolean> {
    const subject = `Lembrete: Seu agendamento é amanhã! — ${data.companyName}`;
    const formattedDate = formatAppointmentDateTime(
      data.appointmentDate,
      data.timezone || 'America/Sao_Paulo',
    );

    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: data.customerName || to }],
        htmlContent: getAppointmentReminderEmailTemplate({
          customerName: data.customerName,
          companyName: data.companyName,
          serviceName: data.serviceName,
          formattedDate,
          address: data.address,
        }),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `E-mail de lembrete de agendamento enviado com sucesso para ${to}`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.APPOINTMENT_REMINDER,
      data,
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de recuperação de senha com link assinado e expiração de 15min.
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetLink: string,
  ): Promise<boolean> {
    const subject = 'Redefinição de Senha — SinalizeGo';
    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: name || to }],
        htmlContent: getPasswordResetEmailTemplate(name, resetLink),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `E-mail de recuperação de senha enviado com sucesso para ${to}`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.PASSWORD_RESET,
      { name, resetLink },
      result,
    );
    return false;
  }

  /**
   * Envia e-mail com senha temporária gerada pelo administrador com aviso de troca obrigatória.
   */
  async sendTemporaryPasswordEmail(
    to: string,
    name: string,
    temporaryPassword: string,
    loginUrl?: string,
  ): Promise<boolean> {
    const subject = 'Sua Nova Senha de Acesso — SinalizeGo';
    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: name || to }],
        htmlContent: getTemporaryPasswordEmailTemplate({
          name,
          temporaryPassword,
          loginUrl,
        }),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `E-mail de senha temporária enviado com sucesso para ${to}`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.TEMPORARY_PASSWORD,
      { name, temporaryPassword, loginUrl },
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de alerta ao administrador quando ocorre falha na emissão de NFS-e junto à prefeitura.
   */
  async sendInvoiceErrorAlertEmail(
    to: string,
    data: {
      invoiceId: string;
      companyName: string;
      companyId: string;
      competence: string;
      grossAmount: number | string;
      errorMessage: string;
    },
  ): Promise<boolean> {
    const subject = `Alerta de Erro na Emissão de NFS-e — ${data.companyName}`;
    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: 'Administrador SinalizeGO' }],
        htmlContent: getInvoiceErrorAlertEmailTemplate(data),
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `Alerta de erro de NFS-e #${data.invoiceId} enviado para admin (${to})`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.INVOICE_ERROR,
      data,
      result,
    );
    return false;
  }

  /**
   * Envia e-mail de alerta ao Super Admin sobre indicação suspeita colocada em REVIEW.
   */
  async sendReferralReviewAlertEmail(
    to: string,
    data: {
      referralId: string;
      referrerName: string;
      referredName: string;
      riskFlags: string[];
    },
  ): Promise<boolean> {
    const subject = `Indicação em Revisão Manual — ${data.referredName}`;
    const flagsText = data.riskFlags?.join?.(', ') || '';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="color: #d97706;">Alerta de Auditoria — Indicação em Revisão Manual</h2>
        <p>Uma indicação entre empresas foi suspensa para <strong>REVIEW</strong> por colisão de dados cadastrais:</p>
        <ul style="background: #fef3c7; padding: 16px 24px; border-radius: 8px;">
          <li><strong>ID da Indicação:</strong> ${data.referralId}</li>
          <li><strong>Empresa Indicadora:</strong> ${data.referrerName}</li>
          <li><strong>Empresa Indicada:</strong> ${data.referredName}</li>
          <li><strong>Flags de Risco:</strong> ${flagsText}</li>
        </ul>
        <p>Acesse a rota de auditoria do Super Admin para validar manualmente se trata-se de caso legítimo ou auto-indicação.</p>
      </div>
    `;

    const sendFn = () =>
      this.brevoClient.transactionalEmails.sendTransacEmail({
        subject,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: 'Super Admin SinalizeGO' }],
        htmlContent,
      });

    const result = await this.executeWithMicroRetry(sendFn, to, subject);

    if (result.success) {
      this.logger.log(
        `Alerta de revisão de indicação #${data.referralId} enviado para Super Admin (${to})`,
      );
      return true;
    }

    await this.enqueueFallback(
      to,
      subject,
      EmailTemplateType.REFERRAL_REVIEW,
      data,
      result,
    );
    return false;
  }

  /**
   * Despacha o e-mail diretamente a partir da fila Outbox (utilizado pelo Worker Cron).
   * Não re-enfileira para permitir que o MailOutboxService controle a política de tentativas e backoff.
   */
  async dispatchFromOutbox(
    template: EmailTemplateType,
    to: string,
    payload: Record<string, any>,
  ): Promise<boolean> {
    try {
      switch (template) {
        case EmailTemplateType.WELCOME:
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: 'Boas-vindas ao SinalizeGo!',
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.name || to }],
            htmlContent: getWelcomeEmailTemplate(payload.name, payload.role),
          });
          return true;

        case EmailTemplateType.APPOINTMENT_CONFIRMATION: {
          const formattedDate = formatAppointmentDateTime(
            payload.appointmentDate,
            payload.timezone || 'America/Sao_Paulo',
          );
          const paidFormatted = Number(
            payload.amountPaid?.toString?.() ?? payload.amountPaid,
          ).toFixed(2);
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: `Agendamento Confirmado — ${payload.companyName}`,
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.customerName || to }],
            htmlContent: getAppointmentConfirmationEmailTemplate({
              appointmentId: payload.appointmentId,
              customerName: payload.customerName,
              companyName: payload.companyName,
              serviceName: payload.serviceName,
              formattedDate,
              amountPaid: paidFormatted,
              paymentMethod: payload.paymentMethod || 'Pix',
            }),
          });
          return true;
        }

        case EmailTemplateType.APPOINTMENT_CANCELLATION: {
          const formattedDate = formatAppointmentDateTime(
            payload.appointmentDate,
            payload.timezone || 'America/Sao_Paulo',
          );
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: `Agendamento Cancelado — ${payload.companyName}`,
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.customerName || to }],
            htmlContent: getAppointmentCancellationEmailTemplate({
              customerName: payload.customerName,
              companyName: payload.companyName,
              serviceName: payload.serviceName,
              formattedDate,
              isRefunded: payload.isRefunded,
              refundAmount: payload.refundAmount,
              policy: payload.policy,
            }),
          });
          return true;
        }

        case EmailTemplateType.OWNER_UNAVAILABILITY: {
          const formattedDate = formatAppointmentDateTime(
            payload.appointmentDate,
            payload.timezone || 'America/Sao_Paulo',
          );
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: `Imprevisto no Horário — Seu sinal virou crédito em ${payload.companyName}`,
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.customerName || to }],
            htmlContent: getOwnerUnavailabilityEmailTemplate({
              customerName: payload.customerName,
              companyName: payload.companyName,
              serviceName: payload.serviceName,
              formattedDate,
              creditAmount: payload.creditAmount,
              rescheduleUrl: payload.rescheduleUrl,
            }),
          });
          return true;
        }

        case EmailTemplateType.APPOINTMENT_REMINDER: {
          const formattedDate = formatAppointmentDateTime(
            payload.appointmentDate,
            payload.timezone || 'America/Sao_Paulo',
          );
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: `Lembrete: Seu agendamento é amanhã! — ${payload.companyName}`,
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.customerName || to }],
            htmlContent: getAppointmentReminderEmailTemplate({
              customerName: payload.customerName,
              companyName: payload.companyName,
              serviceName: payload.serviceName,
              formattedDate,
              address: payload.address,
            }),
          });
          return true;
        }

        case EmailTemplateType.PASSWORD_RESET:
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: 'Redefinição de Senha — SinalizeGo',
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.name || to }],
            htmlContent: getPasswordResetEmailTemplate(
              payload.name,
              payload.resetLink,
            ),
          });
          return true;

        case EmailTemplateType.TEMPORARY_PASSWORD:
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: 'Sua Nova Senha de Acesso — SinalizeGo',
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: payload.name || to }],
            htmlContent: getTemporaryPasswordEmailTemplate({
              name: payload.name,
              temporaryPassword: payload.temporaryPassword,
              loginUrl: payload.loginUrl,
            }),
          });
          return true;

        case EmailTemplateType.INVOICE_ERROR:
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: `Alerta de Erro na Emissão de NFS-e — ${payload.companyName}`,
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: 'Administrador SinalizeGO' }],
            htmlContent: getInvoiceErrorAlertEmailTemplate(payload as any),
          });
          return true;

        case EmailTemplateType.REFERRAL_REVIEW: {
          const flagsText = payload.riskFlags?.join?.(', ') || '';
          const htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
              <h2 style="color: #d97706;">Alerta de Auditoria — Indicação em Revisão Manual</h2>
              <p>Uma indicação entre empresas foi suspensa para <strong>REVIEW</strong> por colisão de dados cadastrais:</p>
              <ul style="background: #fef3c7; padding: 16px 24px; border-radius: 8px;">
                <li><strong>ID da Indicação:</strong> ${payload.referralId}</li>
                <li><strong>Empresa Indicadora:</strong> ${payload.referrerName}</li>
                <li><strong>Empresa Indicada:</strong> ${payload.referredName}</li>
                <li><strong>Flags de Risco:</strong> ${flagsText}</li>
              </ul>
              <p>Acesse a rota de auditoria do Super Admin para validar manualmente se trata-se de caso legítimo ou auto-indicação.</p>
            </div>
          `;
          await this.brevoClient.transactionalEmails.sendTransacEmail({
            subject: `Indicação em Revisão Manual — ${payload.referredName}`,
            sender: { name: this.senderName, email: this.senderEmail },
            to: [{ email: to, name: 'Super Admin SinalizeGO' }],
            htmlContent,
          });
          return true;
        }

        default:
          this.logger.error(
            `[MailService] Template desconhecido recebido do Outbox: ${template}`,
          );
          return false;
      }
    } catch (err: any) {
      this.logger.error(
        `[MailService] Falha ao despachar template ${template} para ${to}: ${err?.message || err}`,
      );
      return false;
    }
  }
}
