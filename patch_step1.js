const fs = require('fs');
const filepath = 'src/asaas/asaas.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// Find: const barberAsaasFee = this.asaasPixFee;
// Replace with: const barberAsaasFee = BARBER_ASAAS_PIX_FEE;

code = code.replace(
  'const barberAsaasFee = this.asaasPixFee;',
  'const barberAsaasFee = BARBER_ASAAS_PIX_FEE;'
);

fs.writeFileSync(filepath, code);
