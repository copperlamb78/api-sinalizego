const fs = require('fs');
const filepath = 'src/asaas/webhook-asaas/webhooks.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// The reviewer noted a double deduction on chargebacks.
// It creates a WITHDRAWAL transaction *and* sets the original transaction to CANCELED.
// We should ONLY create the WITHDRAWAL transaction and leave the original transaction CONFIRMED (to keep history),
// OR we should just set the original transaction to CANCELED and NOT create a WITHDRAWAL.
// But wait, the transaction is already CONFIRMED, if a chargeback happens, Asaas cancels the payment.
// Let's remove the WITHDRAWAL creation and just set the original transaction to CANCELED. This matches the test expectations.

// Actually the tests failed because it expected mockPrisma.transaction.update to be called with CANCELED for the transaction.
// Our patch earlier replaced the update with a create followed by the update.
// Let's revert back to just the update for chargebacks.

const chargebackOriginal = `
        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: TransactionStatus.CANCELED },
          }),
          ...(appointment.status !== ApptStatus.COMPLETED
            ? [
                this.prisma.appointment.update({
                  where: { id: transaction.appointmentId },
                  data: { status: ApptStatus.CANCELED, isActive: false },
                }),
              ]
            : []),
        ]);
`;

code = code.replace(
  /const chargebackTx = await this\.prisma\.transaction\.create\(\{[\s\S]*?\}\);\s*await this\.prisma\.\$transaction\(\[/m,
  'await this.prisma.$transaction(['
);

fs.writeFileSync(filepath, code);
