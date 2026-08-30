const fs = require('fs');
const filepath = 'src/modules/company/company.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

code = code.replace(
  "new import('@nestjs/common').ForbiddenException",
  "new ForbiddenException"
);

// We must also import ForbiddenException
if (!code.includes('ForbiddenException')) {
  code = code.replace(
    /import \{([^}]+)\} from '@nestjs\/common';/,
    "import { $1, ForbiddenException } from '@nestjs/common';"
  );
}

fs.writeFileSync(filepath, code);
