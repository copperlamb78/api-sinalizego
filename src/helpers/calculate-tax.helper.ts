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

    // Aritmética pura de inteiros em centavos (sem multiplicação por decimais)
    const priceCents = Math.round(totalPrice * 100);

    // Faixa 1: até 25.000 centavos (R$ 250,00) com 10%
    const tier1Cents = Math.min(priceCents, 25000);
    const tier2Cents = priceCents > 25000 ? priceCents - 25000 : 0;

    // Frações inteiras de taxa (100 frações = 1 centavo; 2.500 frações = R$ 0,25)
    const feeFractions = tier1Cents * 10 + tier2Cents * 5;
    const minPlatformTaxFractions = Math.round(MIN_PLATFORM_TAX * 100) * 100; // 20.000 frações = R$ 2,00

    const totalFeeFractions = Math.max(feeFractions, minPlatformTaxFractions);

    // Arredondamento para cima em múltiplos de R$ 0,25 (2.500 frações)
    const roundedCents = Math.ceil(totalFeeFractions / 2500) * 25;
    return Number((roundedCents / 100).toFixed(2));
  }
}
