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
      // 10 * 0.15 = 1.50 -> Min fee = 2.00
      expect(helper.calculatePlatformTax(10)).toBe(2.0);
      // 5 * 0.15 = 0.75 -> Min fee = 2.00
      expect(helper.calculatePlatformTax(5)).toBe(2.0);
    });

    it('should calculate 15% for values in Tier 1 (up to R$ 50.00)', () => {
      // 30 * 0.15 = 4.50
      expect(helper.calculatePlatformTax(30)).toBe(4.5);
      // 50 * 0.15 = 7.50
      expect(helper.calculatePlatformTax(50)).toBe(7.5);
    });

    it('should calculate cumulative tax for Tier 2 (R$ 50.01 to R$ 250.00)', () => {
      // 100 -> Faixa 1 (50 * 0.15 = 7.50) + Faixa 2 ((100 - 50) * 0.10 = 5.00) = 12.50
      expect(helper.calculatePlatformTax(100)).toBe(12.5);
      // 250 -> Faixa 1 (50 * 0.15 = 7.50) + Faixa 2 (200 * 0.10 = 20.00) = 27.50
      expect(helper.calculatePlatformTax(250)).toBe(27.5);
    });

    it('should calculate cumulative tax for Tier 3 (above R$ 250.00)', () => {
      // 300 -> Faixa 1 (7.50) + Faixa 2 (20.00) + Faixa 3 ((300 - 250) * 0.05 = 2.50) = 30.00
      expect(helper.calculatePlatformTax(300)).toBe(30.0);
      // 500 -> Faixa 1 (7.50) + Faixa 2 (20.00) + Faixa 3 ((500 - 250) * 0.05 = 12.50) = 40.00
      expect(helper.calculatePlatformTax(500)).toBe(40.0);
    });

    it('should always round UP to the nearest multiple of R$ 0.25 (ex: 2.25, 2.50, 2.75, 3.00)', () => {
      // 15.80 * 0.15 = 2.37 -> rounds UP to 2.50
      expect(helper.calculatePlatformTax(15.8)).toBe(2.5);
      // 22.80 * 0.15 = 3.42 -> rounds UP to 3.50
      expect(helper.calculatePlatformTax(22.8)).toBe(3.5);
      // 16.00 * 0.15 = 2.40 -> rounds UP to 2.50
      expect(helper.calculatePlatformTax(16)).toBe(2.5);
      // 18.00 * 0.15 = 2.70 -> rounds UP to 2.75
      expect(helper.calculatePlatformTax(18)).toBe(2.75);
    });

    it('should handle boundary decimals rounding up to multiple of 0.25 accurately', () => {
      // 50.01 -> 50 * 0.15 = 7.50 + 0.01 * 0.10 = 0.001 -> 7.501 -> rounds up to 7.75
      expect(helper.calculatePlatformTax(50.01)).toBe(7.75);
      // 250.01 -> 27.50 + 0.01 * 0.05 = 27.5005 -> rounds up to 27.75
      expect(helper.calculatePlatformTax(250.01)).toBe(27.75);
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
      // 50: fee = 7.50, rate = 7.50 / 50 = 0.15
      expect(helper.calculatePlatformTaxPercentage(50)).toBe(0.15);
      // 100: fee = 12.50, rate = 12.50 / 100 = 0.125
      expect(helper.calculatePlatformTaxPercentage(100)).toBe(0.125);
      // 300: fee = 30.00, rate = 30.00 / 300 = 0.1
      expect(helper.calculatePlatformTaxPercentage(300)).toBe(0.1);
    });
  });
});
