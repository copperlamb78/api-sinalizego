import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import { getPasswordResetEmailTemplate } from './templates/email.templates';

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
}
