const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// In getDashboardMetrics, the metrics are computed inside a loop:
// We need to change completedDepositsNet and escrowLockedBalance to use transaction netValue.
// However, getDashboardMetrics loops over appointments. It fetches downPaymentAmount from appointment.
// We need to either include transactions in the appointments query, or do an aggregate.
// The plan says: "update the balance calculation logic to also use Transaction.netValue by aggregating from confirmed transactions instead of using completedDepositsNet derived from downPaymentAmount."

code = code.replace(
  'completedDepositsNet += downPayment; // Bolt optimization',
  '// completedDepositsNet sum removed'
);

code = code.replace(
  'escrowLockedBalance += downPayment; // Bolt optimization',
  '// escrowLockedBalance sum removed'
);

code = code.replace(
  'let completedDepositsNet = 0;',
  'let completedDepositsNet = 0;' // leave it
);

const aggregateNetValue = `
    const completedTxAgg = await this.prisma.transaction.aggregate({
      where: {
        appointment: {
          companyId: company.id,
          isActive: true,
          status: ApptStatus.COMPLETED,
        },
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.CONFIRMED,
      },
      _sum: { netValue: true },
    });
    completedDepositsNet = Number(completedTxAgg._sum.netValue || 0);

    const escrowTxAgg = await this.prisma.transaction.aggregate({
      where: {
        appointment: {
          companyId: company.id,
          isActive: true,
          status: ApptStatus.CONFIRMED,
        },
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.CONFIRMED,
      },
      _sum: { netValue: true },
    });
    escrowLockedBalance = Number(escrowTxAgg._sum.netValue || 0);
`;

// Insert after the loop
code = code.replace(
  /const validCount = completedCount \+ confirmedCount \+ canceledCount;/g,
  aggregateNetValue + '\n    const validCount = completedCount + confirmedCount + canceledCount;'
);

fs.writeFileSync(filepath, code);
