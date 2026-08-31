const fs = require('fs');

// We have tests failing with:
// "Estabelecimento não possui perfil financeiro ou subconta Asaas configurada."
// In company.service.ts requestInstantWithdrawal, it checks pixAddressKey and pixAddressKeyType.
// The tests for requestInstantWithdrawal don't mock pixAddressKey and pixAddressKeyType in the mocked financial profile.
// We need to fix the tests to include those.

const testFile = 'src/modules/company/company.service.spec.ts';
let testCode = fs.readFileSync(testFile, 'utf8');

testCode = testCode.replace(
  /walletId: 'mock-wallet-id',\s+asaasApiKey: 'mock-encrypted-key',/g,
  "walletId: 'mock-wallet-id', asaasApiKey: 'mock-encrypted-key', pixAddressKey: '12345678909', pixAddressKeyType: 'CPF',"
);

// We also have failures in AsaasService tests for cancelPayment/refundPayment:
// "InternalServerErrorException: Falha na comunicação com Asaas ao cancelar cobrança: {"errors":[]}"
// This is because we changed it to throw instead of return false.
// We need to update the tests to expect throws.

const asaasTestFile = 'src/asaas/asaas.service.spec.ts';
let asaasTestCode = fs.readFileSync(asaasTestFile, 'utf8');

asaasTestCode = asaasTestCode.replace(
  /const result = await service\.cancelPayment\('pay_fail'\);\n\n      expect\(result\)\.toBe\(false\);/g,
  "await expect(service.cancelPayment('pay_fail')).rejects.toThrow(InternalServerErrorException);"
);

asaasTestCode = asaasTestCode.replace(
  /const result = await service\.refundPayment\('pay_fail'\);\n\n      expect\(result\)\.toBe\(false\);/g,
  "await expect(service.refundPayment('pay_fail')).rejects.toThrow(InternalServerErrorException);"
);

fs.writeFileSync(testFile, testCode);
fs.writeFileSync(asaasTestFile, asaasTestCode);
