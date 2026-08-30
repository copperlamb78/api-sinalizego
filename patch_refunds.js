const fs = require('fs');
const filepath = 'src/asaas/asaas.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// cancelPayment
code = code.replace(
  /return false;\n      }\n\n      return true;/g,
  'throw new InternalServerErrorException(typeof errorData === "object" ? JSON.stringify(errorData) : String(errorData));\n      }\n\n      return true;'
);

code = code.replace(
  /return false;\n    }\n  }\n\n  \/\*\*\n   \* Estorna/g,
  'throw new InternalServerErrorException("Falha na comunicação com Asaas ao cancelar cobrança: " + error.message);\n    }\n  }\n\n  /**\n   * Estorna'
);

// refundPayment
code = code.replace(
  /return false;\n      }\n\n      return true;\n    } catch/g,
  'throw new InternalServerErrorException(typeof errorData === "object" ? JSON.stringify(errorData) : String(errorData));\n      }\n\n      return true;\n    } catch'
);

code = code.replace(
  /return false;\n    }\n  }\n\n  \/\*\*\n   \* Consulta/g,
  'throw new InternalServerErrorException("Falha na comunicação com Asaas ao estornar cobrança: " + error.message);\n    }\n  }\n\n  /**\n   * Consulta'
);

fs.writeFileSync(filepath, code);
