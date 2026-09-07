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

  constructor(private readonly configService: ConfigService) {
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
      appointmentId?: string;
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
          appointmentId: data.appointmentId,
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
      policy?: 'REFUND' | 'CREDIT' | 'RETAINED';
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
          policy: data.policy,
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
   * Envia e-mail de notificação de imprevisto do estabelecimento com link mágico para reagendamento e crédito garantido (Salvar a Venda).
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
    try {
      const formattedDate = formatAppointmentDateTime(
        data.appointmentDate,
        data.timezone || 'America/Sao_Paulo',
      );

      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `Imprevisto no Horário — Seu sinal virou crédito em ${data.companyName}`,
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

      this.logger.log(
        `E-mail de imprevisto e reagendamento com crédito enviado com sucesso para ${to}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de imprevisto para ${to}: ${error?.message || error}`,
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
   * Envia e-mail com senha temporária gerada pelo administrador com aviso de troca obrigatória.
   */
  async sendTemporaryPasswordEmail(
    to: string,
    name: string,
    temporaryPassword: string,
    loginUrl?: string,
  ): Promise<boolean> {
    try {
      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: 'Sua Nova Senha de Acesso — SinalizeGo 🔑',
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

      this.logger.log(
        `E-mail de senha temporária enviado com sucesso para ${to}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de senha temporária para ${to}: ${error?.message || error}`,
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
    try {
      const flagsText = data.riskFlags.join(', ');
      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
          <h2 style="color: #d97706;">⚠️ Alerta de Auditoria — Indicação em Revisão Manual</h2>
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

      await this.brevoClient.transactionalEmails.sendTransacEmail({
        subject: `⚠️ Indicação em Revisão Manual — ${data.referredName}`,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to, name: 'Super Admin SinalizeGO' }],
        htmlContent,
      });

      this.logger.log(
        `Alerta de revisão de indicação #${data.referralId} enviado para Super Admin (${to})`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar alerta de revisão de indicação para ${to}: ${error?.message || error}`,
      );
      return false;
    }
  }
}
