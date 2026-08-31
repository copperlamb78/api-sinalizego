const fs = require('fs');
const filepath = 'prisma/schema.prisma';
let code = fs.readFileSync(filepath, 'utf8');

// Insert pixAddressKey and pixAddressKeyType in FinancialProfile
// find: walletId    String  @unique
// add after it.

const addStr = `
  pixAddressKey     String? // Chave PIX
  pixAddressKeyType String? // Tipo da chave PIX (CPF, EMAIL, PHONE, RANDOM)
`;

code = code.replace(
  'walletId    String  @unique // ID da carteira gerada no Asaas',
  'walletId    String  @unique // ID da carteira gerada no Asaas' + addStr
);

fs.writeFileSync(filepath, code);
