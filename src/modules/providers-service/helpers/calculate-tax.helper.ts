import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculateTax {
  async calculatePlatformTax(totalPrice: number): Promise<number> {
    if (totalPrice <= 50) return 15;
    if (totalPrice < 250) return 10;
    return 5;
  }
}
