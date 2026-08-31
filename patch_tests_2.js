const fs = require('fs');

// Also update `executeWeeklyFreePayouts` test in company.service.spec.ts
// The test expects 1 executed payout because company with 150 > 100 limit.
// We introduced Transaction.netValue aggregation. We should check if the test sets netValue or downPaymentAmount.
// It sets downPaymentAmount, so completedAgg returns 0.

const testFile = 'src/modules/company/company.service.spec.ts';
let testCode = fs.readFileSync(testFile, 'utf8');

// The test mocks Prisma.transaction.aggregate:
testCode = testCode.replace(
  /if \(params\.where\?\.barberWalletId === 'wallet-1'\) \{\n\s*return \{ _sum: \{ totalValue: 50\.0 \} \};\n\s*\}/g,
  "if (params.where?.barberWalletId === 'wallet-1' && params._sum.totalValue) { return { _sum: { totalValue: 50.0 } }; }"
);

testCode = testCode.replace(
  /if \(params\.where\?\.barberWalletId === 'wallet-2'\) \{\n\s*return \{ _sum: \{ totalValue: 5\.0 \} \};\n\s*\}/g,
  "if (params.where?.barberWalletId === 'wallet-2' && params._sum.totalValue) { return { _sum: { totalValue: 5.0 } }; }"
);

testCode = testCode.replace(
  /aggregate: jest\.fn\(\)\.mockImplementation\(\(params\) => \{/g,
  `aggregate: jest.fn().mockImplementation((params) => {
          if (params._sum.netValue) {
            if (params.where?.appointment?.companyId === 'comp-1' && params.where?.status === 'CONFIRMED' && params.where?.appointment?.status === 'COMPLETED') {
              return { _sum: { netValue: 200.0 } };
            }
            if (params.where?.appointment?.companyId === 'comp-2' && params.where?.status === 'CONFIRMED' && params.where?.appointment?.status === 'COMPLETED') {
              return { _sum: { netValue: 50.0 } };
            }
            return { _sum: { netValue: 0 } };
          }
`
);

fs.writeFileSync(testFile, testCode);
