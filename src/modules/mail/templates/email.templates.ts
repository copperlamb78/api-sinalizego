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
    .summary-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
    }
    .summary-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .summary-label {
      color: #64748b;
      font-weight: 600;
    }
    .summary-value {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
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
        <p>Você recebeu este e-mail porque possui uma conta ou agendamento na plataforma <strong>SinalizeGo</strong>.</p>
        <p>&copy; ${currentYear} SinalizeGo — Plataforma de Gestão e Agendamentos. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Formata uma data para exibição amigável com fuso horário.
 */
export function formatAppointmentDateTime(
  date: Date | string,
  timezone: string = 'America/Sao_Paulo',
): string {
  try {
    const d = new Date(date);
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(d);
  } catch {
    return new Date(date).toLocaleString('pt-BR');
  }
}

/**
 * Template de Boas-Vindas
 */
export function getWelcomeEmailTemplate(name: string, role?: string): string {
  const firstName = name ? name.trim().split(' ')[0] : 'Usuário';
  const isOwner = role === 'COMPANY_OWNER';

  const content = `
    <h2>Boas-vindas ao SinalizeGo! 🚀</h2>
    <p>Olá, <strong>${firstName}</strong>!</p>
    <p>Seu cadastro foi realizado com sucesso. Estamos muito felizes em ter você conosco na plataforma mais inteligente de agendamentos e gestão de serviços.</p>
    
    ${
      isOwner
        ? `<div class="callout-info">
            <strong>🏢 Comece seu negócio:</strong> Configure sua grade de horários, cadastre seus serviços e vincule sua chave Asaas para receber pagamentos via Pix com split automatizado!
          </div>`
        : `<div class="callout-info">
            <strong>✂️ Agende seu horário:</strong> Explore os melhores estabelecimentos, escolha seus serviços favoritos e garanta seu horário com praticidade.
          </div>`
    }

    <p>Se tiver qualquer dúvida ou precisar de suporte, nossa equipe está sempre pronta para ajudar.</p>
  `;

  return baseEmailLayout({
    title: 'Boas-vindas ao SinalizeGo!',
    previewText: `Olá ${firstName}, seja muito bem-vindo(a) ao SinalizeGo!`,
    content,
  });
}

/**
 * Template de Confirmação de Agendamento
 */
export function getAppointmentConfirmationEmailTemplate(data: {
  customerName: string;
  companyName: string;
  serviceName: string;
  formattedDate: string;
  amountPaid: string;
}): string {
  const firstName = data.customerName
    ? data.customerName.trim().split(' ')[0]
    : 'Cliente';

  const content = `
    <h2>Agendamento Confirmado! 🎉</h2>
    <p>Olá, <strong>${firstName}</strong>!</p>
    <p>Seu pagamento foi aprovado e o agendamento no estabelecimento <strong>${data.companyName}</strong> está 100% confirmado.</p>

    <div class="summary-card">
      <div class="summary-item">
        <span class="summary-label">Estabelecimento:</span>
        <span class="summary-value">${data.companyName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Serviço:</span>
        <span class="summary-value">${data.serviceName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Data & Horário:</span>
        <span class="summary-value">${data.formattedDate}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Sinal Pago Online:</span>
        <span class="summary-value">R$ ${data.amountPaid}</span>
      </div>
    </div>

    <div class="callout-info">
      <strong>💡 Dica:</strong> Recomendamos chegar com 5 a 10 minutos de antecedência ao estabelecimento.
    </div>
  `;

  return baseEmailLayout({
    title: 'Agendamento Confirmado — SinalizeGo',
    previewText: `Seu agendamento em ${data.companyName} para ${data.formattedDate} foi confirmado com sucesso!`,
    content,
  });
}

/**
 * Template de Cancelamento de Agendamento
 */
export function getAppointmentCancellationEmailTemplate(data: {
  customerName: string;
  companyName: string;
  serviceName: string;
  formattedDate: string;
  isRefunded: boolean;
}): string {
  const firstName = data.customerName
    ? data.customerName.trim().split(' ')[0]
    : 'Cliente';

  const content = `
    <h2>Agendamento Cancelado 🗓️</h2>
    <p>Olá, <strong>${firstName}</strong>!</p>
    <p>Informamos que o seu agendamento no estabelecimento <strong>${data.companyName}</strong> foi cancelado.</p>

    <div class="summary-card">
      <div class="summary-item">
        <span class="summary-label">Estabelecimento:</span>
        <span class="summary-value">${data.companyName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Serviço:</span>
        <span class="summary-value">${data.serviceName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Data & Horário:</span>
        <span class="summary-value">${data.formattedDate}</span>
      </div>
    </div>

    ${
      data.isRefunded
        ? `<div class="callout-info">
            <strong>💰 Estorno Processado:</strong> Como o cancelamento ocorreu com mais de 24 horas de antecedência, o valor pago via Pix foi estornado integralmente para sua conta.
          </div>`
        : `<div class="callout-warning">
            <strong>⚠️ Atenção:</strong> Conforme nossa política de cancelamento, cancelamentos com menos de 24 horas de antecedência não geram estorno do sinal pago.
          </div>`
    }
  `;

  return baseEmailLayout({
    title: 'Agendamento Cancelado — SinalizeGo',
    previewText: `Seu agendamento em ${data.companyName} foi cancelado.`,
    content,
  });
}

/**
 * Template de Lembrete de Agendamento (D-1)
 */
export function getAppointmentReminderEmailTemplate(data: {
  customerName: string;
  companyName: string;
  serviceName: string;
  formattedDate: string;
  address?: string;
}): string {
  const firstName = data.customerName
    ? data.customerName.trim().split(' ')[0]
    : 'Cliente';

  const content = `
    <h2>Lembrete: Seu agendamento é amanhã! ⏰</h2>
    <p>Olá, <strong>${firstName}</strong>!</p>
    <p>Passando para lembrar do seu horário agendado para amanhã no <strong>${data.companyName}</strong>.</p>

    <div class="summary-card">
      <div class="summary-item">
        <span class="summary-label">Estabelecimento:</span>
        <span class="summary-value">${data.companyName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Serviço:</span>
        <span class="summary-value">${data.serviceName}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Data & Horário:</span>
        <span class="summary-value">${data.formattedDate}</span>
      </div>
      ${
        data.address
          ? `<div class="summary-item">
              <span class="summary-label">Endereço:</span>
              <span class="summary-value">${data.address}</span>
            </div>`
          : ''
      }
    </div>

    <div class="callout-info">
      <strong>✨ Nos vemos amanhã!</strong> Não se esqueça de comparecer no horário marcado.
    </div>
  `;

  return baseEmailLayout({
    title: 'Lembrete de Agendamento — SinalizeGo',
    previewText: `Lembrete: seu agendamento em ${data.companyName} é amanhã às ${data.formattedDate}!`,
    content,
  });
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
