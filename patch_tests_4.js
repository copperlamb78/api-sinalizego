const fs = require('fs');
const testFile = 'src/modules/company/company.service.spec.ts';
let testCode = fs.readFileSync(testFile, 'utf8');

// getCompanyBalance test fails at `!financialProfile?.pixAddressKeyType`
// Looking at the code, in `requestInstantWithdrawal`, it does:
// select: { id: true, walletId: true, pixAddressKey: true, pixAddressKeyType: true }
// In the test, Prisma transaction aggregate returns based on `where: { appointment: { companyId: ... } }`.
// Wait, the findFirst mock in `getCompanyBalance` is missing the extra fields for some tests.
testCode = testCode.replace(
  /findFirst: jest\.fn\(\)\.mockResolvedValue\(\{ id: 'prof-1', walletId: 'wallet-1', pixAddressKey: '12345678909', pixAddressKeyType: 'CPF' \}\),/g,
  "findFirst: jest.fn().mockImplementation((params) => { if (params.where?.userId || params.where?.OR) { return { id: 'prof-1', walletId: 'wallet-1', pixAddressKey: '12345678909', pixAddressKeyType: 'CPF' }; } return null; }),"
);

// We should replace any findFirst returning profile without pix fields.
testCode = testCode.replace(
  /return \{\n\s*id: 'prof-1',\n\s*walletId: 'wallet-1',\n\s*asaasApiKey: 'key-1',\n\s*pixAddressKey: '12345678909',\n\s*pixAddressKeyType: 'CPF',\n\s*\};/g,
  "return { id: 'prof-1', walletId: 'wallet-1', asaasApiKey: 'key-1', pixAddressKey: '12345678909', pixAddressKeyType: 'CPF' };"
);

// And we have findFirst inside `executeWeeklyFreePayouts` test that returns mockProfile.
testCode = testCode.replace(
  /const mockProfile = \{\n\s*walletId: 'wallet-1',\n\s*pixAddressKey: '12345678909',\n\s*pixAddressKeyType: 'CPF',\n\s*\};/g,
  "const mockProfile = { walletId: 'wallet-1', pixAddressKey: '12345678909', pixAddressKeyType: 'CPF' };"
);

// In getDashboardMetrics, the expected output for findFirst is userId.
// Our patch was:
// select: { id: true, businessName: true, slug: true, userId: true },
// The test expects select: { id: true, businessName: true, slug: true }
// We need to change the test expectation.
testCode = testCode.replace(
  /select: \{ id: true, businessName: true, slug: true \},/g,
  "select: { id: true, businessName: true, slug: true, userId: true },"
);

fs.writeFileSync(testFile, testCode);
