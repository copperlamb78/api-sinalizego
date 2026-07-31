import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculateTax {
  async calculatePlatformTaxPercentage(totalPrice: number): Promise<number> {
    if (totalPrice <= 50) return 0.15;
    if (totalPrice < 250) return 0.1;
    return 0.05;
  }

  async calculatePlatformTax(totalPrice: number): Promise<number> {
    const baseFee =
      totalPrice * (await this.calculatePlatformTaxPercentage(totalPrice));
    const platformFee = Math.max(baseFee, 2.0); // Taxa mínima de R$ 2,00
    return platformFee;
  }
}
