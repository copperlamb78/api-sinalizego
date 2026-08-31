const fs = require('fs');
const filepath = 'src/asaas/asaas.service.ts';
let code = fs.readFileSync(filepath, 'utf8');

// Add getTransferFee method in AsaasService
const getTransferFeeMethod = `
  async getTransferFee(): Promise<number> {
    try {
      if (!this.apiKey) return 5.0;
      const response = await fetch(\`\${this.apiUrl}/myAccount/fees\`, {
        method: 'GET',
        headers: this.headers,
      });

      if (response.ok) {
        const data = await response.json();
        const fee = data?.transfer?.pix?.feeValue;
        if (fee !== undefined && fee !== null && !isNaN(Number(fee)) && Number(fee) >= 0) {
          return Number(fee);
        }
      }
      return 5.0;
    } catch (err: any) {
      this.logger.debug(
        \`Falha ao consultar taxas de transferencia no Asaas: \${err?.message || err}\`,
      );
      return 5.0; // fallback default
    }
  }
`;

code = code.replace(
  'async fetchAccountFees(): Promise<any> {',
  getTransferFeeMethod + '\n\n  async fetchAccountFees(): Promise<any> {'
);

fs.writeFileSync(filepath, code);
