const fs = require('fs');
const filepath = 'src/asaas/webhook-asaas/webhooks.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

const idemStr = `
        // Idempotency: Prevent reversion of REFUNDED or CANCELED transactions
        if (
          transaction.status === TransactionStatus.REFUNDED ||
          transaction.status === TransactionStatus.CANCELED
        ) {
          this.logger.warn(
            \`[Webhook Asaas][\${correlationId}] Ignorando CONFIRMED em pagamento já \${transaction.status}.\`,
          );
          return {
            received: true,
            event,
            paymentId: payment.id,
            ignored: true,
            reason: \`Transaction already \${transaction.status}\`,
          };
        }

        // Salvaguarda Anti-Race Condition: Se o agendamento já foi cancelado ou expirou antes do pagamento
`;

code = code.replace(
  '// Salvaguarda Anti-Race Condition: Se o agendamento já foi cancelado ou expirou antes do pagamento',
  idemStr
);

fs.writeFileSync(filepath, code);
