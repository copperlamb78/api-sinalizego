const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// The original queries are:
//     const completedAgg = await tx.appointment.aggregate({
//       where: {
//         companyId: company.id,
//         isActive: true,
//         status: ApptStatus.COMPLETED,
//       },
//       _sum: { downPaymentAmount: true },
//     });
//     const completedNetRevenue = Number(completedAgg._sum.downPaymentAmount || 0);

// I need to change this to sum Transaction.netValue for transactions linked to this company where status = CONFIRMED, type = DEPOSIT, appointment.status = COMPLETED.
// Since transaction doesn't have companyId directly, we can join with appointment.companyId

const replaceTransactionSum = `
    const completedAgg = await tx.transaction.aggregate({
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
    const completedNetRevenue = Number(
      completedAgg._sum.netValue || 0,
    );

    const escrowAgg = await tx.transaction.aggregate({
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
    const escrowLocked = Number(escrowAgg._sum.netValue || 0);
`;

code = code.replace(
  /const completedAgg = await tx\.appointment\.aggregate\(\{[\s\S]*?const escrowLocked = Number\(escrowAgg\._sum\.downPaymentAmount \|\| 0\);/m,
  replaceTransactionSum
);

// We must also fix `getCompanyBalance` which uses this.prisma instead of tx.
const replaceTransactionSumPrisma = `
    const completedAgg = await this.prisma.transaction.aggregate({
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
    const completedNetRevenue = Number(
      completedAgg._sum.netValue || 0,
    );

    const escrowAgg = await this.prisma.transaction.aggregate({
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
    const escrowLockedBalance = Number(escrowAgg._sum.netValue || 0);
`;

code = code.replace(
  /const completedAgg = await this\.prisma\.appointment\.aggregate\(\{[\s\S]*?const escrowLockedBalance = Number\(escrowAgg\._sum\.downPaymentAmount \|\| 0\);/m,
  replaceTransactionSumPrisma
);

fs.writeFileSync(filepath, code);
