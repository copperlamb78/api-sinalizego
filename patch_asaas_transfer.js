const fs = require('fs');
const filepath = 'src/asaas/asaas.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// Modify transferSubaccountBalance to handle two-hop
const twoHopStr = `
    if (options?.isFreeWeekly) {
      const masterWalletId = process.env.ASAAS_MASTER_WALLET_ID;
      if (masterWalletId) {
        // 1. Transfer to Master Account (Free)
        const hop1Payload = {
          value: Number(value.toFixed(2)),
          walletId: masterWalletId,
          description: 'Transferência para conta mestre SinalizeGO (subsídio de taxa)',
        };
        const hop1Response = await fetch(\`\${this.apiUrl}/transfers\`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            access_token: accountApiKey,
          },
          body: JSON.stringify(hop1Payload),
        });

        if (!hop1Response.ok) {
          const err = await hop1Response.json();
          throw new BadRequestException(\`Asaas Hop1: \${err?.errors?.[0]?.description || 'Erro'}\`);
        }

        // 2. Transfer from Master Account to Barber's Pix (Master absorbs the fee)
        const hop2Payload: any = {
          value: Number(value.toFixed(2)),
          description: options?.description || 'Saque automático semanal gratuito SinalizeGO',
          operationType: 'PIX',
          pixAddressKey: options?.pixAddressKey,
        };
        if (options?.pixAddressKeyType) {
          hop2Payload.pixAddressKeyType = options.pixAddressKeyType;
        }

        const hop2Response = await fetch(\`\${this.apiUrl}/transfers\`, {
          method: 'POST',
          headers: this.headers, // master API key
          body: JSON.stringify(hop2Payload),
        });

        if (!hop2Response.ok) {
          const err = await hop2Response.json();
          throw new BadRequestException(\`Asaas Hop2: \${err?.errors?.[0]?.description || 'Erro'}\`);
        }

        return await hop2Response.json();
      }
    }
`;

code = code.replace(
  'const transferPayload: any = {',
  twoHopStr + '\n    const transferPayload: any = {'
);

fs.writeFileSync(filepath, code);
