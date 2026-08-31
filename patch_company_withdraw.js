const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// Replace hardcoded ASAAS_TRANSFER_FEE with await this.asaasService.getTransferFee()
code = code.replace(
  'const transferFee = ASAAS_TRANSFER_FEE;',
  'const transferFee = await this.asaasService.getTransferFee();'
);

// We need to check executeWeeklyFreePayouts to use getTransferFee? No, weekly is free.
// In getCompanyBalance, instantTransferFee is returned. We need to make it dynamic but getCompanyBalance is not async in the property initialization, wait it is async.
code = code.replace(
  'instantTransferFee: ASAAS_TRANSFER_FEE,',
  'instantTransferFee: await this.asaasService.getTransferFee(),'
);

fs.writeFileSync(filepath, code);
