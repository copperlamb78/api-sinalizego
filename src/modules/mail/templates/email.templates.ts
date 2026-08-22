/**
 * Template base reutilizável para todos os e-mails transacionais do SinalizeGo.
 * Garante design consistente, responsivo e compatível com os principais clientes de e-mail (Gmail, Outlook, Apple Mail, etc.).
 */
interface BaseEmailProps {
  title: string;
  previewText?: string;
  content: string;
}

export function baseEmailLayout({
  title,
  previewText,
  content,
}: BaseEmailProps): string {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-collapse: collapse;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header-logo {
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
      text-decoration: none;
    }
    .header-logo span {
      color: #38bdf8;
    }
    .body-content {
      padding: 36px 32px;
      color: #334155;
      font-size: 16px;
      line-height: 1.6;
    }
    .body-content h2 {
      color: #0f172a;
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 16px 0;
    }
    .body-content p {
      margin: 0 0 16px 0;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn-primary {
      display: inline-block;
      background: #0284c7;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
      transition: background-color 0.2s ease;
    }
    .callout-warning {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
    }
    .callout-info {
      background-color: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #166534;
    }
    .link-fallback {
      word-break: break-all;
      color: #0284c7;
      font-size: 13px;
      text-decoration: underline;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      font-size: 13px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0 0 8px 0;
    }
    .footer p:last-child {
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-logo">Sinalize<span>Go</span></div>
      </div>
      <div class="body-content">
        ${content}
      </div>
      <div class="footer">
        <p>Você recebeu este e-mail porque possui uma conta na plataforma <strong>SinalizeGo</strong>.</p>
        <p>&copy; ${currentYear} SinalizeGo — Plataforma de Gestão e Agendamentos. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Template de Redefinição de Senha
 */
export function getPasswordResetEmailTemplate(
  name: string,
  resetLink: string,
): string {
  const firstName = name ? name.trim().split(' ')[0] : 'Usuário';

  const content = `
    <h2>Recuperação de Senha</h2>
    <p>Olá, <strong>${firstName}</strong>!</p>
    <p>Recebemos uma solicitação para redefinir a senha de acesso à sua conta no <strong>SinalizeGo</strong>.</p>
    <p>Para criar uma nova senha, clique no botão abaixo:</p>
    
    <div class="btn-container">
      <a href="${resetLink}" target="_blank" class="btn-primary">Redefinir Minha Senha</a>
    </div>

    <div class="callout-warning">
      <strong>⚠️ Importante:</strong> Este link é válido por <strong>15 minutos</strong> e expira automaticamente após a conclusão da alteração. Se você não solicitou este procedimento, nenhuma ação é necessária e sua senha continuará segura.
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
      Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br>
      <a href="${resetLink}" class="link-fallback">${resetLink}</a>
    </p>
  `;

  return baseEmailLayout({
    title: 'Redefinição de Senha — SinalizeGo',
    previewText:
      'Instruções para redefinir sua senha no SinalizeGo (válido por 15 minutos).',
    content,
  });
}

/**
 * Template de Confirmação de E-mail (Para uso futuro / Confirmação de cadastro e alteração)
 */
export function getEmailConfirmationTemplate(
  name: string,
  confirmationLink: string,
): string {
  const firstName = name ? name.trim().split(' ')[0] : 'Usuário';

  const content = `
    <h2>Confirmação de E-mail</h2>
    <p>Olá, <strong>${firstName}</strong>!</p>
    <p>Obrigado por utilizar o <strong>SinalizeGo</strong>. Por favor, confirme o seu endereço de e-mail clicando no botão abaixo:</p>
    
    <div class="btn-container">
      <a href="${confirmationLink}" target="_blank" class="btn-primary">Confirmar Meu E-mail</a>
    </div>

    <div class="callout-info">
      <strong>✨ Quase lá!</strong> A confirmação garante a segurança da sua conta e permite o recebimento de notificações dos seus agendamentos.
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
      Caso o botão não funcione, acesse o link:<br>
      <a href="${confirmationLink}" class="link-fallback">${confirmationLink}</a>
    </p>
  `;

  return baseEmailLayout({
    title: 'Confirmação de E-mail — SinalizeGo',
    previewText:
      'Por favor, confirme seu endereço de e-mail para ativar sua conta no SinalizeGo.',
    content,
  });
}
