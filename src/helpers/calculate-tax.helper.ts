import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculateTax {
  calculatePlatformTaxPercentage(totalPrice: number): number {
    if (totalPrice <= 0) return 0;
    const platformFee = this.calculatePlatformTax(totalPrice);
    return Number((platformFee / totalPrice).toFixed(4));
  }

  calculatePlatformTax(totalPrice: number): number {
    if (totalPrice <= 0) return 0;

    let baseFee = 0;

    // Faixa 1: até R$ 50,00 (15%)
    const tier1Amount = Math.min(totalPrice, 50);
    baseFee += tier1Amount * 0.15;

    // Faixa 2: de R$ 50,01 até R$ 250,00 (10%)
    if (totalPrice > 50) {
      const tier2Amount = Math.min(totalPrice, 250) - 50;
      baseFee += tier2Amount * 0.1;
    }

    // Faixa 3: acima de R$ 250,00 (5%)
    if (totalPrice > 250) {
      const tier3Amount = totalPrice - 250;
      baseFee += tier3Amount * 0.05;
    }

    const platformFee = Math.max(baseFee, 2.0); // Taxa mínima de R$ 2,00
    return Number(platformFee.toFixed(2));
  }
}

