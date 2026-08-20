import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

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
      'nao-responda@sinalizego.com';
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
        htmlContent: this.getPasswordResetTemplate(name, resetLink),
      });

      this.logger.log(`E-mail de recuperação de senha enviado com sucesso para ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Falha ao enviar e-mail de recuperação para ${to}: ${error?.message || error}`,
      );
      return false;
    }
  }

  private getPasswordResetTemplate(name: string, resetLink: string): string {
    const recipientName = name ? name.split(' ')[0] : 'Usuário';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 36px 32px; color: #334155; line-height: 1.6; }
    .content p { margin: 0 0 16px 0; font-size: 16px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 6px rgba(37,99,235,0.25); }
    .warning { background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 14px; color: #64748b; }
    .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .link-fallback { word-break: break-all; color: #2563eb; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SinalizeGo</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${recipientName}</strong>!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta na plataforma <strong>SinalizeGo</strong>.</p>
      <p>Clique no botão abaixo para escolher uma nova senha segura:</p>
      
      <div class="btn-container">
        <a href="${resetLink}" target="_blank" class="btn">Redefinir Minha Senha</a>
      </div>

      <div class="warning">
        <strong>Atenção:</strong> Este link é válido por <strong>15 minutos</strong> e expira automaticamente após o uso. Se você não solicitou a alteração, por favor desconsidere este e-mail.
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Se o botão não funcionar, copie e cole o link a seguir no seu navegador:<br>
        <a href="${resetLink}" class="link-fallback">${resetLink}</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SinalizeGo — Plataforma de Gestão e Agendamento. Todos os direitos reservados.
    </div>
  </div>
</body>
</html>
    `;
  }
}
