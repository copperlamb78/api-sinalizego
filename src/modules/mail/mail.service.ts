import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import {
  formatAppointmentDateTime,
  getAppointmentCancellationEmailTemplate,
  getAppointmentConfirmationEmailTemplate,
  getAppointmentReminderEmailTemplate,
  getInvoiceErrorAlertEmailTemplate,
  getPasswordResetEmailTemplate,
  getWelcomeEmailTemplate,
} from './templates/email.templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly brevoClient: BrevoClient;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('BREVO_API_KEY') ||
      process.env.BREVO_API_KEY ||
      '';
    this.brevoClient = new BrevoClient({ apiKey });

    this.senderEmail =
      this.configService.get<string>('MAIL_FROM_EMAIL') ||
      process.env.MAIL_FROM_EMAIL ||
      'neodevzone@gmail.com';
    this.senderName =
      this.configService.get<string>('MAIL_FROM_NAME') ||
      process.env.MAIL_FROM_NAME ||
      'SinalizeGo';
  }

  /**
   * Envia e-mail de boas-vindas para novos usuários cadastrados.
   */
  async sendWelcomeEmail(
    to: string,
    name: string,
    role?: string,
  ): Promise<boolean> {
    try {
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: 'Boas-vindas ao SinalizeGo! 🚀',
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: name || to }],
        htmlContent: getWelcomeEmailTemplate(name, role),
      });

      this.logger.log(`E-mail de boas-vindas enviado com sucesso para ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de boas-vindas para ${to}: ${error?.message || error}`,
      );
      return false;
    }
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
      timezone?: string;
    },
  ): Promise<boolean> {
    try {
      const formattedDate = formatAppointmentDateTime(
        data.appointmentDate,
        data.timezone || 'America/Sao_Paulo',
      );
      const paidFormatted = Number(
        data.amountPaid?.toString?.() ?? data.amountPaid,
      ).toFixed(2);

      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `Agendamento Confirmado — ${data.companyName} 🎉`,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: data.customerName || to }],
        htmlContent: getAppointmentConfirmationEmailTemplate({
          customerName: data.customerName,
          companyName: data.companyName,
          serviceName: data.serviceName,
          formattedDate,
          amountPaid: paidFormatted,
        }),
      });

      this.logger.log(
        `E-mail de confirmação de agendamento enviado com sucesso para ${to}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de confirmação para ${to}: ${error?.message || error}`,
      );
      return false;
    }
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
      timezone?: string;
    },
  ): Promise<boolean> {
    try {
      const formattedDate = formatAppointmentDateTime(
        data.appointmentDate,
        data.timezone || 'America/Sao_Paulo',
      );

      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `Agendamento Cancelado — ${data.companyName}`,
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
        }),
      });

      this.logger.log(
        `E-mail de cancelamento de agendamento enviado com sucesso para ${to}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de cancelamento para ${to}: ${error?.message || error}`,
      );
      return false;
    }
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
    try {
      const formattedDate = formatAppointmentDateTime(
        data.appointmentDate,
        data.timezone || 'America/Sao_Paulo',
      );

      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `Lembrete: Seu agendamento é amanhã! ⏰ — ${data.companyName}`,
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

      this.logger.log(
        `E-mail de lembrete de agendamento enviado com sucesso para ${to}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de lembrete para ${to}: ${error?.message || error}`,
      );
      return false;
    }
  }

  /**
   * Envia e-mail de recuperação de senha com link assinado e expiração de 15min.
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetLink: string,
  ): Promise<boolean> {
    try {
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: 'Redefinição de Senha — SinalizeGo',
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: name || to }],
        htmlContent: getPasswordResetEmailTemplate(name, resetLink),
      });

      this.logger.log(
        `E-mail de recuperação de senha enviado com sucesso para ${to}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de recuperação para ${to}: ${error?.message || error}`,
      );
      return false;
    }
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
    try {
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `⚠️ Alerta de Erro na Emissão de NFS-e — ${data.companyName}`,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: 'Administrador SinalizeGO' }],
        htmlContent: getInvoiceErrorAlertEmailTemplate(data),
      });

      this.logger.log(
        `Alerta de erro de NFS-e #${data.invoiceId} enviado para admin (${to})`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar alerta de erro de NFS-e para ${to}: ${error?.message || error}`,
      );
      return false;
    }
  }
}
