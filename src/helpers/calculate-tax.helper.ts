import { Injectable } from '@nestjs/common';
import { MIN_PLATFORM_TAX } from 'src/common/constants/billing.constant';

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

    const platformFee = Math.max(baseFee, MIN_PLATFORM_TAX); // Taxa mínima de R$ 2,00

    // Arredondamento para cima sempre em múltiplos de R$ 0,25 (ex: 2.25, 2.50, 2.75, 3.00)
    const roundedFee = Math.ceil(platformFee * 4) / 4;
    return Number(roundedFee.toFixed(2));
  }
}

