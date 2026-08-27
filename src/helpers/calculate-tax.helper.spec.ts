import { Test, TestingModule } from '@nestjs/testing';
import { CalculateTax } from './calculate-tax.helper';

describe('CalculateTax Helper', () => {
  let helper: CalculateTax;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalculateTax],
    }).compile();

    helper = module.get<CalculateTax>(CalculateTax);
  });

  it('should be defined', () => {
    expect(helper).toBeDefined();
  });

  describe('calculatePlatformTax (Cumulative Progressive Brackets)', () => {
    it('should return 0 when totalPrice is 0 or negative', () => {
      expect(helper.calculatePlatformTax(0)).toBe(0);
      expect(helper.calculatePlatformTax(-20)).toBe(0);
    });

    it('should apply minimum fee of R$ 2.00 when calculated tax is lower than 2.00 in Tier 1', () => {
      // 10 * 0.10 = 1.00 -> Min fee = 2.00
      expect(helper.calculatePlatformTax(10)).toBe(2.0);
      // 5 * 0.10 = 0.50 -> Min fee = 2.00
      expect(helper.calculatePlatformTax(5)).toBe(2.0);
      // 15 * 0.10 = 1.50 -> Min fee = 2.00
      expect(helper.calculatePlatformTax(15)).toBe(2.0);
    });

    it('should calculate 10% for values in Tier 1 (up to R$ 250.00)', () => {
      // 20 * 0.10 = 2.00
      expect(helper.calculatePlatformTax(20)).toBe(2.0);
      // 30 * 0.10 = 3.00
      expect(helper.calculatePlatformTax(30)).toBe(3.0);
      // 50 * 0.10 = 5.00
      expect(helper.calculatePlatformTax(50)).toBe(5.0);
      // 60 * 0.10 = 6.00
      expect(helper.calculatePlatformTax(60)).toBe(6.0);
      // 100 * 0.10 = 10.00
      expect(helper.calculatePlatformTax(100)).toBe(10.0);
      // 250 * 0.10 = 25.00
      expect(helper.calculatePlatformTax(250)).toBe(25.0);
    });

    it('should calculate cumulative tax for Tier 2 (above R$ 250.00: 25.00 + 5% of excess)', () => {
      // 300 -> Faixa 1 (250 * 0.10 = 25.00) + Faixa 2 ((300 - 250) * 0.05 = 2.50) = 27.50
      expect(helper.calculatePlatformTax(300)).toBe(27.5);
      // 500 -> Faixa 1 (25.00) + Faixa 2 ((500 - 250) * 0.05 = 12.50) = 37.50
      expect(helper.calculatePlatformTax(500)).toBe(37.5);
      // 1000 -> Faixa 1 (25.00) + Faixa 2 ((1000 - 250) * 0.05 = 37.50) = 62.50
      expect(helper.calculatePlatformTax(1000)).toBe(62.5);
    });

    it('should always round UP to the nearest multiple of R$ 0.25 (ex: 2.25, 2.50, 2.75, 3.00)', () => {
      // 22.80 * 0.10 = 2.28 -> rounds UP to 2.50
      expect(helper.calculatePlatformTax(22.8)).toBe(2.5);
      // 26.00 * 0.10 = 2.60 -> rounds UP to 2.75
      expect(helper.calculatePlatformTax(26)).toBe(2.75);
      // 28.50 * 0.10 = 2.85 -> rounds UP to 3.00
      expect(helper.calculatePlatformTax(28.5)).toBe(3.0);
      // 31.00 * 0.10 = 3.10 -> rounds UP to 3.25
      expect(helper.calculatePlatformTax(31)).toBe(3.25);
    });

    it('should handle boundary decimals rounding up to multiple of 0.25 accurately', () => {
      // 250.01 -> 25.00 + 0.01 * 0.05 = 25.0005 -> rounds up to 25.25
      expect(helper.calculatePlatformTax(250.01)).toBe(25.25);
    });
  });

  describe('calculatePlatformTaxPercentage', () => {
    it('should return 0 when totalPrice is 0 or negative', () => {
      expect(helper.calculatePlatformTaxPercentage(0)).toBe(0);
      expect(helper.calculatePlatformTaxPercentage(-10)).toBe(0);
    });

    it('should return effective tax rate correctly', () => {
      // 10: fee = 2.00, rate = 2.00 / 10 = 0.2
      expect(helper.calculatePlatformTaxPercentage(10)).toBe(0.2);
      // 50: fee = 5.00, rate = 5.00 / 50 = 0.1
      expect(helper.calculatePlatformTaxPercentage(50)).toBe(0.1);
      // 100: fee = 10.00, rate = 10.00 / 100 = 0.1
      expect(helper.calculatePlatformTaxPercentage(100)).toBe(0.1);
      // 300: fee = 27.50, rate = 27.50 / 300 = 0.0917
      expect(helper.calculatePlatformTaxPercentage(300)).toBe(0.0917);
    });
  });
});
