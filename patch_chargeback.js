const fs = require('fs');
const filepath = 'src/asaas/webhook-asaas/webhooks.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// For chargeback
const chargebackLogic = `
        const chargebackTx = await this.prisma.transaction.create({
          data: {
            asaasPaymentId: \`cb_\${payment.id}\`,
            totalValue: transaction.totalValue,
            netValue: transaction.netValue,
            platformFee: 0,
            asaasFee: 0,
            status: TransactionStatus.CONFIRMED,
            type: TransactionType.WITHDRAWAL,
            billingType: transaction.billingType,
            customerId: transaction.customerId,
            barberWalletId: transaction.barberWalletId,
            appointmentId: undefined, // cannot use same appointment ID since it's unique
          },
        });

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
  /await this\.prisma\.\$transaction\(\[\s*this\.prisma\.transaction\.update\(\{\s*where: \{ id: transaction\.id \},\s*data: \{ status: TransactionStatus\.CANCELED \},\s*\}\),\s*\.\.\.\(appointment\.status !== ApptStatus\.COMPLETED[\s\S]*?: \[\]\),\s*\]\);/m,
  chargebackLogic
);

fs.writeFileSync(filepath, code);
