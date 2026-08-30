const fs = require('fs');

// The tests in company.service.spec.ts are still failing with:
// "Estabelecimento não possui perfil financeiro ou subconta Asaas configurada."
// Let's modify the mock financial profile creation in the setup phase.

const testFile = 'src/modules/company/company.service.spec.ts';
let testCode = fs.readFileSync(testFile, 'utf8');

// There are multiple places where a mock profile is returned.
testCode = testCode.replace(
  /const mockFinancialProfile = \{\n\s*id: 'prof-1',\n\s*walletId: 'mock-wallet-id',\n\s*asaasApiKey: 'mock-encrypted-key',\n\s*\};/g,
  "const mockFinancialProfile = {\n      id: 'prof-1',\n      walletId: 'mock-wallet-id',\n      asaasApiKey: 'mock-encrypted-key',\n      pixAddressKey: '12345678909',\n      pixAddressKeyType: 'CPF',\n    };"
);

testCode = testCode.replace(
  /financialProfile: \{\n\s*id: 'prof-1',\n\s*walletId: 'mock-wallet-id',\n\s*asaasApiKey: 'mock-encrypted-key',\n\s*\}/g,
  "financialProfile: {\n      id: 'prof-1',\n      walletId: 'mock-wallet-id',\n      asaasApiKey: 'mock-encrypted-key',\n      pixAddressKey: '12345678909',\n      pixAddressKeyType: 'CPF',\n    }"
);

// We need to also patch the getCompanyWithdrawalHistory test.
testCode = testCode.replace(
  /const mockProfile = \{\n\s*walletId: 'wallet-1',\n\s*\};/g,
  "const mockProfile = {\n        walletId: 'wallet-1',\n        pixAddressKey: '12345678909',\n        pixAddressKeyType: 'CPF',\n      };"
);

// We need to patch getCompanyBalance test
testCode = testCode.replace(
  /findFirst: jest\.fn\(\)\.mockImplementation\(\(params\) => \{\n\s*if \(params\.where\.userId === 'user-owner'\) \{\n\s*return \{\n\s*id: 'prof-1',\n\s*walletId: 'wallet-1',\n\s*asaasApiKey: 'key-1',\n\s*\};\n\s*\}/g,
  "findFirst: jest.fn().mockImplementation((params) => {\n        if (params.where.userId === 'user-owner' || params.where?.OR?.[0]?.userId === 'user-owner') {\n          return {\n            id: 'prof-1',\n            walletId: 'wallet-1',\n            asaasApiKey: 'key-1',\n            pixAddressKey: '12345678909',\n            pixAddressKeyType: 'CPF',\n          };\n        }"
);

// There's a generic mock for findFirst:
testCode = testCode.replace(
  /findFirst: jest\.fn\(\)\.mockResolvedValue\(\{ id: 'prof-1', walletId: 'wallet-1' \}\),/g,
  "findFirst: jest.fn().mockResolvedValue({ id: 'prof-1', walletId: 'wallet-1', pixAddressKey: '12345678909', pixAddressKeyType: 'CPF' }),"
);

fs.writeFileSync(testFile, testCode);
