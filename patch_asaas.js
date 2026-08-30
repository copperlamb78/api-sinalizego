const fs = require('fs');
const filepath = 'src/asaas/asaas.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// Update transferSubaccountBalance signature
code = code.replace(
  'pixAddressKey?: string;\n      description?: string;',
  'pixAddressKey?: string;\n      pixAddressKeyType?: string;\n      description?: string;'
);

code = code.replace(
  'transferPayload.pixAddressKey = options.pixAddressKey;\n    }',
  'transferPayload.pixAddressKey = options.pixAddressKey;\n      if (options.pixAddressKeyType) transferPayload.pixAddressKeyType = options.pixAddressKeyType;\n    }'
);

fs.writeFileSync(filepath, code);
