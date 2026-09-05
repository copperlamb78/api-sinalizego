/**
 * Template Base e Geradores de E-mail Transacional do SinalizeGO
 * Identidade Visual Oficial Dark Mode (Paleta: #0B1120, #0F172A, #1E293B, #14B8A6, #EF4444, #F8FAFC)
 */

interface BaseEmailLayoutProps {
  title: string;
  previewText?: string;
  actionTitle: string;
  actionTitleColor?: string;
  introHtml: string;
  infoCardHtml?: string;
  cta?: {
    text: string;
    url: string;
    bgColor?: string;
  };
  additionalContentHtml?: string;
}

/**
 * Casca HTML institucional canônica Dark Mode para todos os e-mails da plataforma.
 */
export function baseEmailLayout({
  title,
  previewText,
  actionTitle,
  actionTitleColor = '#F8FAFC',
  introHtml,
  infoCardHtml,
  cta,
  additionalContentHtml,
}: BaseEmailLayoutProps): string {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${previewText ? `<div style="display:none;font-size:1px;color:#0B1120;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
    <style>
        /* Reset e compatibilidade para clientes de email (Gmail, Outlook, Apple Mail) */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #0B1120; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    </style>
</head>
<body style="background-color: #0B1120; margin: 0; padding: 40px 20px;">
    
    <!-- Wrapper Central do Email (Max 600px) -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0F172A; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        
        <!-- HEADER (Logo Institucional SinalizeGO) -->
        <tr>
            <td align="center" style="padding: 40px 20px 25px 20px;">
                <img 
                    src="${process.env.APP_LOGO_URL || 'https://res.cloudinary.com/dsg7aisg9/image/upload/v1787494139/Blue_and_Black_Minimalist_Professional_Business_Brand_Logo_khpcbp.png'}" 
                    alt="SinalizeGO" 
                    width="180" 
                    style="display: block; border: 0; outline: none; text-decoration: none; max-width: 180px; height: auto; margin: 0 auto;" 
                />
            </td>
        </tr>
        
        <!-- TÍTULO DA AÇÃO -->
        <tr>
            <td align="center" style="padding: 0px 40px 20px 40px;">
                <h1 style="color: ${actionTitleColor}; font-size: 26px; margin: 0; font-weight: bold; line-height: 1.3;">${actionTitle}</h1>
            </td>
        </tr>

        <!-- CORPO DO TEXTO (Introdução) -->
        <tr>
            <td style="padding: 10px 40px 25px 40px;">
                <p style="color: #E8E8E8; font-size: 16px; line-height: 1.6; margin: 0;">
                    ${introHtml}
                </p>
            </td>
        </tr>

        <!-- CARD DE INFORMAÇÕES INTERNO (#1E293B) -->
        ${
          infoCardHtml
            ? `<tr>
            <td style="padding: 0px 40px 30px 40px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1E293B; border-radius: 8px; padding: 25px;">
                    ${infoCardHtml}
                </table>
            </td>
        </tr>`
            : ''
        }

        <!-- CONTEÚDO ADICIONAL (Ex: Fallbacks, Notas de Segurança) -->
        ${
          additionalContentHtml
            ? `<tr>
            <td style="padding: 0px 40px 25px 40px;">
                ${additionalContentHtml}
            </td>
        </tr>`
            : ''
        }

        <!-- CALL TO ACTION (Botão Principal #14B8A6) -->
        ${
          cta
            ? `<tr>
            <td align="center" style="padding: 10px 40px 40px 40px;">
                <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                        <td align="center" bgcolor="${cta.bgColor || '#14B8A6'}" style="border-radius: 25px;">
                            <a href="${cta.url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #FFFFFF; text-decoration: none; font-weight: bold; border-radius: 25px;">
                                ${cta.text}
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>`
            : ''
        }

        <!-- FOOTER INSTITUCIONAL -->
        <tr>
            <td align="center" style="padding: 30px 40px; background-color: #0B1120;">
                <p style="color: #64748B; font-size: 13px; line-height: 1.6; margin: 0;">
                    Você está recebendo este e-mail porque possui uma conta ou agendamento na <strong>SinalizeGO</strong>.<br>
                    Por favor, não responda diretamente a esta mensagem.<br><br>
                    Precisa de suporte? <a href="mailto:suporte@sinalizego.com" style="color: #14B8A6; text-decoration: none; font-weight: 500;">suporte@sinalizego.com</a><br><br>
                    &copy; ${currentYear} SinalizeGO. Todos os direitos reservados.
                </p>
            </td>
        </tr>
    </table>
    
</body>
</html>`;
}

/**
 * Formata uma data para exibição amigável em Português com fuso horário.
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
 * 1. Template de Boas-Vindas (Welcome Email)
 */
export function getWelcomeEmailTemplate(name: string, role?: string): string {
  const firstName = name ? name.trim().split(' ')[0] : 'Usuário';
  const isOwner = role === 'COMPANY_OWNER';

  const introHtml = `
    Olá, <strong>${firstName}</strong>!<br><br>
    ${
      isOwner
        ? 'Seu cadastro como <strong>estabelecimento parceiro</strong> no SinalizeGO foi concluído com sucesso. Agora você pode configurar sua grade de expediente, gerenciar sua equipe e receber pagamentos de agendamentos com split automatizado via Pix!'
        : 'Seu cadastro no <strong>SinalizeGO</strong> foi concluído com sucesso. Estamos prontos para conectar você aos melhores profissionais, com agendamentos rápidos e pagamento seguro do sinal via Pix!'
    }
  `;

  const infoCardHtml = `
    <tr>
        <td style="padding-bottom: 15px;">
            <span style="color: #14B8A6; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Vantagens da sua conta</span>
        </td>
    </tr>
    <tr>
        <td style="padding-bottom: 10px;">
            <span style="color: #F8FAFC; font-size: 15px; font-weight: 500;">⚡ Agendamentos 100% Online e Sem Filas</span>
        </td>
    </tr>
    <tr>
        <td style="padding-bottom: 10px;">
            <span style="color: #F8FAFC; font-size: 15px; font-weight: 500;">🔒 Garantia e Segurança em Pagamentos Pix</span>
        </td>
    </tr>
    <tr>
        <td>
            <span style="color: #F8FAFC; font-size: 15px; font-weight: 500;">⏰ Lembretes Automáticos na Véspera do Atendimento</span>
        </td>
    </tr>
  `;

  return baseEmailLayout({
    title: 'Boas-vindas ao SinalizeGO! 🚀',
    previewText: `Olá ${firstName}, seja muito bem-vindo(a) ao SinalizeGO!`,
    actionTitle: 'Seja muito bem-vindo! 🚀',
    introHtml,
    infoCardHtml,
    cta: {
      text: isOwner ? 'Completar Meu Perfil' : 'Acessar Plataforma',
      url: 'https://app.sinalizego.com',
      bgColor: '#14B8A6',
    },
  });
}

/**
 * 2. Template de Confirmação de Agendamento (Payment Confirmed)
 */
export function getAppointmentConfirmationEmailTemplate(data: {
  customerName: string;
  companyName: string;
  serviceName: string;
  formattedDate: string;
  amountPaid: string;
  servicePrice?: string;
  address?: string;
}): string {
  const firstName = data.customerName
    ? data.customerName.trim().split(' ')[0]
    : 'Cliente';

  const introHtml = `
    Olá, <strong>${firstName}</strong>!<br><br>
    Seu pagamento via Pix para o serviço no estabelecimento <strong>${data.companyName}</strong> foi confirmado com sucesso. Abaixo estão os detalhes completos do seu agendamento:
  `;

  const infoCardHtml = `
    <!-- Linha 1: Serviço -->
    <tr>
        <td style="padding-bottom: 20px;">
            <span style="color: #14B8A6; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Serviço</span><br>
            <span style="color: #F8FAFC; font-size: 18px; font-weight: bold; margin-top: 5px; display: inline-block;">${data.serviceName}</span>
        </td>
    </tr>
    <!-- Linha 2: Estabelecimento & Endereço -->
    <tr>
        <td style="padding-bottom: 20px;">
            <span style="color: #94A3B8; font-size: 13px;">Estabelecimento</span><br>
            <span style="color: #F8FAFC; font-size: 16px; font-weight: 500;">${data.companyName}</span>
            ${
              data.address
                ? `<br><span style="color: #94A3B8; font-size: 13px; display: inline-block; margin-top: 4px;">📍 ${data.address}</span>`
                : ''
            }
        </td>
    </tr>
    <!-- Linha 3: Data & Horário -->
    <tr>
        <td style="padding-bottom: 20px;">
            <span style="color: #94A3B8; font-size: 13px;">Data e Horário</span><br>
            <span style="color: #F8FAFC; font-size: 16px; font-weight: 500;">${data.formattedDate}</span>
        </td>
    </tr>
    <!-- Linha 4: Valores e Status (Com separador) -->
    <tr>
        <td style="padding-top: 20px; border-top: 1px solid rgba(248, 250, 252, 0.1);">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td width="50%">
                        <span style="color: #94A3B8; font-size: 13px;">Status</span><br>
                        <span style="color: #F8FAFC; font-size: 16px; font-weight: bold;">Confirmado ✅</span>
                    </td>
                    <td width="50%">
                        <span style="color: #14B8A6; font-size: 13px; font-weight: bold;">Sinal Pago (Pix)</span><br>
                        <span style="color: #14B8A6; font-size: 20px; font-weight: bold;">R$ ${data.amountPaid}</span>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
  `;

  return baseEmailLayout({
    title: `Agendamento Confirmado — ${data.companyName} 🎉`,
    previewText: `Seu agendamento em ${data.companyName} para ${data.formattedDate} foi confirmado com sucesso!`,
    actionTitle: 'Pagamento Confirmado! 🎉',
    introHtml,
    infoCardHtml,
    cta: {
      text: 'Ver Meu Agendamento',
      url: 'https://app.sinalizego.com/agendamentos',
      bgColor: '#14B8A6',
    },
  });
}

/**
 * 3. Template de Lembrete de Agendamento (D-1 Reminder)
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

  const introHtml = `
    Olá, <strong>${firstName}</strong>!<br><br>
    Passando para lembrar que o seu atendimento no estabelecimento <strong>${data.companyName}</strong> é <strong>amanhã</strong>. Organize seu dia e chegue com alguns minutos de antecedência:
  `;

  const infoCardHtml = `
    <!-- Linha 1: Serviço -->
    <tr>
        <td style="padding-bottom: 20px;">
            <span style="color: #14B8A6; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Serviço</span><br>
            <span style="color: #F8FAFC; font-size: 18px; font-weight: bold; margin-top: 5px; display: inline-block;">${data.serviceName}</span>
        </td>
    </tr>
    <!-- Linha 2: Estabelecimento & Endereço -->
    <tr>
        <td style="padding-bottom: 20px;">
            <span style="color: #94A3B8; font-size: 13px;">Estabelecimento</span><br>
            <span style="color: #F8FAFC; font-size: 16px; font-weight: 500;">${data.companyName}</span>
            ${
              data.address
                ? `<br><span style="color: #94A3B8; font-size: 13px; display: inline-block; margin-top: 4px;">📍 ${data.address}</span>`
                : ''
            }
        </td>
    </tr>
    <!-- Linha 3: Data & Horário -->
    <tr>
        <td>
            <span style="color: #94A3B8; font-size: 13px;">Data e Horário</span><br>
            <span style="color: #F8FAFC; font-size: 16px; font-weight: 500;">${data.formattedDate}</span>
        </td>
    </tr>
  `;

  return baseEmailLayout({
    title: `Lembrete: Seu agendamento é amanhã! ⏰ — ${data.companyName}`,
    previewText: `Lembrete: seu agendamento em ${data.companyName} é amanhã às ${data.formattedDate}!`,
    actionTitle: 'Seu serviço é amanhã! ⏰',
    introHtml,
    infoCardHtml,
    cta: {
      text: 'Ver Detalhes do Agendamento',
      url: 'https://app.sinalizego.com/agendamentos',
      bgColor: '#14B8A6',
    },
  });
}

/**
 * 4. Template de Cancelamento de Agendamento (Cancellation & Refund Notice)
 */
export function getAppointmentCancellationEmailTemplate(data: {
  customerName: string;
  companyName: string;
  serviceName: string;
  formattedDate: string;
  isRefunded: boolean;
  refundAmount?: number;
}): string {
  const firstName = data.customerName
    ? data.customerName.trim().split(' ')[0]
    : 'Cliente';

  const introHtml = `
    Olá, <strong>${firstName}</strong>!<br><br>
    Informamos que o seu agendamento no estabelecimento <strong>${data.companyName}</strong> foi cancelado. Confira abaixo os detalhes e a situação do seu sinal:
  `;

  const infoCardHtml = `
    <!-- Linha 1: Serviço -->
    <tr>
        <td style="padding-bottom: 20px;">
            <span style="color: #94A3B8; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Serviço Cancelado</span><br>
            <span style="color: #F8FAFC; font-size: 18px; font-weight: bold; margin-top: 5px; display: inline-block;">${data.serviceName}</span>
        </td>
    </tr>
    <!-- Linha 2: Estabelecimento & Data -->
    <tr>
        <td style="padding-bottom: 20px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td width="50%">
                        <span style="color: #94A3B8; font-size: 13px;">Estabelecimento</span><br>
                        <span style="color: #F8FAFC; font-size: 15px; font-weight: 500;">${data.companyName}</span>
                    </td>
                    <td width="50%">
                        <span style="color: #94A3B8; font-size: 13px;">Data/Horário</span><br>
                        <span style="color: #F8FAFC; font-size: 15px; font-weight: 500;">${data.formattedDate}</span>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    <!-- Linha 3: Status do Reembolso Pix -->
    <tr>
        <td style="padding-top: 20px; border-top: 1px solid rgba(248, 250, 252, 0.1);">
            ${
              data.isRefunded
                ? `<div>
                    <span style="color: #14B8A6; font-size: 13px; font-weight: bold; text-transform: uppercase;">Status do Reembolso (Pix)</span><br>
                    <span style="color: #14B8A6; font-size: 16px; font-weight: bold; margin-top: 4px; display: inline-block;">Estorno Realizado com Sucesso 💰</span>
                    <p style="color: #94A3B8; font-size: 13px; line-height: 1.5; margin: 6px 0 0 0;">
                        ${
                          data.refundAmount
                            ? `O valor de <strong>R$ ${Number(data.refundAmount).toFixed(2)}</strong> pago via Pix foi estornado para a sua conta.`
                            : 'O valor do estorno via Pix foi devolvido para a sua conta.'
                        }
                    </p>
                </div>`
                : `<div>
                    <span style="color: #EF4444; font-size: 13px; font-weight: bold; text-transform: uppercase;">Status do Reembolso (Pix)</span><br>
                    <span style="color: #EF4444; font-size: 16px; font-weight: bold; margin-top: 4px; display: inline-block;">Sinal Retido ⚠️</span>
                    <p style="color: #94A3B8; font-size: 13px; line-height: 1.5; margin: 6px 0 0 0;">
                        Conforme a política de cancelamento, o sinal mínimo foi retido pelo estabelecimento como indenização pela reserva da vaga (Arts. 417 a 420 do Código Civil).
                    </p>
                </div>`
            }
        </td>
    </tr>
  `;

  return baseEmailLayout({
    title: `Agendamento Cancelado — ${data.companyName}`,
    previewText: `Seu agendamento em ${data.companyName} foi cancelado.`,
    actionTitle: 'Agendamento Cancelado',
    actionTitleColor: '#EF4444',
    introHtml,
    infoCardHtml,
    cta: {
      text: 'Fazer Novo Agendamento',
      url: 'https://app.sinalizego.com',
      bgColor: '#14B8A6',
    },
  });
}

/**
 * 5. Template de Redefinição de Senha (Password Reset)
 */
export function getPasswordResetEmailTemplate(
  name: string,
  resetLink: string,
): string {
  const firstName = name ? name.trim().split(' ')[0] : 'Usuário';

  const introHtml = `
    Olá, <strong>${firstName}</strong>!<br><br>
    Recebemos uma solicitação para redefinir a senha de acesso à sua conta no <strong>SinalizeGO</strong>. Para criar uma nova senha com segurança, clique no botão abaixo:
  `;

  const infoCardHtml = `
    <tr>
        <td>
            <span style="color: #14B8A6; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Segurança & Validade</span><br>
            <p style="color: #F8FAFC; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;">
                ⏱️ Este link é válido por <strong>15 minutos</strong> e expira automaticamente após o primeiro uso.<br>
                🛡️ Se você não solicitou esta redefinição, nenhuma ação é necessária e sua senha continuará segura.
            </p>
        </td>
    </tr>
  `;

  const additionalContentHtml = `
    <p style="color: #64748B; font-size: 12px; line-height: 1.5; margin: 0; word-break: break-all;">
        Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br>
        <a href="${resetLink}" style="color: #14B8A6; text-decoration: underline;">${resetLink}</a>
    </p>
  `;

  return baseEmailLayout({
    title: 'Redefinição de Senha — SinalizeGo',
    previewText:
      'Instruções para redefinir sua senha no SinalizeGO (válido por 15 minutos).',
    actionTitle: 'Recuperação de Senha 🔒',
    introHtml,
    infoCardHtml,
    additionalContentHtml,
    cta: {
      text: 'Redefinir Minha Senha',
      url: resetLink,
      bgColor: '#14B8A6',
    },
  });
}

/**
 * 6. Template de Alerta de Erro na Emissão de NFS-e (Admin Alert)
 */
export function getInvoiceErrorAlertEmailTemplate(data: {
  invoiceId: string;
  companyName: string;
  companyId: string;
  competence: string;
  grossAmount: number | string;
  errorMessage: string;
}): string {
  const introHtml = `
    Atenção, Administrador!<br><br>
    Ocorreu uma falha na autorização/emissão da <strong>NFS-e</strong> junto à prefeitura via gateway Asaas.<br>
    O gateway não realiza retentativas automáticas em notas rejeitadas; a correção cadastral ou ajuste no painel do Asaas é necessária.
  `;

  const infoCardHtml = `
    <tr>
        <td style="padding-bottom: 12px;">
            <span style="color: #EF4444; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Detalhes da Falha</span><br>
            <p style="color: #F8FAFC; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;">
                🏢 <strong>Empresa:</strong> ${data.companyName} (#${data.companyId})<br>
                📅 <strong>Competência:</strong> ${data.competence}<br>
                💰 <strong>Valor Consolidado:</strong> R$ ${Number(data.grossAmount).toFixed(2)}<br>
                🆔 <strong>ID da Invoice:</strong> ${data.invoiceId}<br>
                ⚠️ <strong>Motivo do Erro:</strong> <span style="color: #EF4444;">${data.errorMessage}</span>
            </p>
        </td>
    </tr>
  `;

  return baseEmailLayout({
    title: '⚠️ Erro na Emissão de NFS-e — SinalizeGO',
    previewText: `Falha na emissão de NFS-e para ${data.companyName} (${data.competence})`,
    actionTitle: 'Falha na Emissão de NFS-e ⚠️',
    actionTitleColor: '#EF4444',
    introHtml,
    infoCardHtml,
  });
}
