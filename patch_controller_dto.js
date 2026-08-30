const fs = require('fs');
const filepath = 'src/asaas/webhook-asaas/webhooks.controller.ts';
let code = fs.readFileSync(filepath, 'utf8');

code = "import { AsaasWebhookDto } from './dto/asaas-webhook.dto';\n" + code;
code = code.replace(
  'async handleAsaasWebhook(@Body() payload: any) {',
  'async handleAsaasWebhook(@Body() payload: AsaasWebhookDto) {'
);

fs.writeFileSync(filepath, code);
