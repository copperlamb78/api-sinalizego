const fs = require('fs');
const filepath = 'src/asaas/webhook-asaas/webhooks.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

const replacement = `
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
`;

code = code.replace(
  /async handleAsaasEvent\([\s\S]*?rawPayload\?: any,\n  \) \{\n    if \(!payment\?\.id\) \{\n      return \{ received: true, ignored: true, reason: 'Missing payment\.id' \};\n    \}/m,
  replacement
);

code = code.replace(
  /return \{ received: true, event, paymentId: payment\.id \};\n  \}\n\n  \/\*\*\n   \* Salva o evento/m,
  'return { received: true, event, paymentId: payment.id };\n    } catch (error: any) {\n      this.logger.error(`[Webhook Asaas] Erro no processamento do evento ${event} (${payment?.id}): ${error.message}`);\n      return { received: true, error: error.message };\n    }\n  }\n\n  /**\n   * Salva o evento'
);

fs.writeFileSync(filepath, code);
