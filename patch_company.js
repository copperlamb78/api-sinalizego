const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// In requestInstantWithdrawal:
// find: select: { id: true, walletId: true },
// replace: select: { id: true, walletId: true, pixAddressKey: true, pixAddressKeyType: true },

code = code.replace(
  /select: { id: true, walletId: true },/g,
  'select: { id: true, walletId: true, pixAddressKey: true, pixAddressKeyType: true },'
);

// find: if (!financialProfile?.walletId) {
// replace: if (!financialProfile?.walletId || !financialProfile?.pixAddressKey || !financialProfile?.pixAddressKeyType) {

code = code.replace(
  /if \(!financialProfile\?\.walletId\) {/g,
  'if (!financialProfile?.walletId || !financialProfile?.pixAddressKey || !financialProfile?.pixAddressKeyType) {'
);

// In requestInstantWithdrawal API call:
// find: { isFreeWeekly: false }
// replace: { isFreeWeekly: false, pixAddressKey: financialProfile.pixAddressKey, pixAddressKeyType: financialProfile.pixAddressKeyType }

code = code.replace(
  '{ isFreeWeekly: false }',
  '{ isFreeWeekly: false, pixAddressKey: financialProfile.pixAddressKey, pixAddressKeyType: financialProfile.pixAddressKeyType }'
);

// In executeWeeklyFreePayouts API call:
// find: { isFreeWeekly: true }
// replace: { isFreeWeekly: true, pixAddressKey: financialProfile.pixAddressKey, pixAddressKeyType: financialProfile.pixAddressKeyType }

code = code.replace(
  '{ isFreeWeekly: true }',
  '{ isFreeWeekly: true, pixAddressKey: financialProfile.pixAddressKey, pixAddressKeyType: financialProfile.pixAddressKeyType }'
);

fs.writeFileSync(filepath, code);
