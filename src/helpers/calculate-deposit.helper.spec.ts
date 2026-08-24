import { Test, TestingModule } from '@nestjs/testing';
import { CalculateDeposit } from './calculate-deposit.helper';

describe('CalculateDeposit Helper', () => {
  let helper: CalculateDeposit;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalculateDeposit],
    }).compile();

    helper = module.get<CalculateDeposit>(CalculateDeposit);
  });

  it('should be defined', () => {
    expect(helper).toBeDefined();
  });

  describe('calculateDepositDetails & calculateDeposit', () => {
    it('should return 0 when totalPrice is 0 or negative', () => {
      expect(helper.calculateDeposit(0, 50)).toBe(0);
      expect(helper.calculateDeposit(-10, 50)).toBe(0);
    });

    it('should strictly enforce 100% upfront for services below R$ 15.00', () => {
      const result = helper.calculateDepositDetails(12.5, 50);
      expect(result.depositAmount).toBe(12.5);
      expect(result.appliedPercent).toBe(100);
      expect(result.isFullUpfront).toBe(true);
      expect(helper.calculateDeposit(12.5, 50)).toBe(12.5);
    });

    it('should calculate 50% deposit for standard service of R$ 60.00 -> R$ 30.00', () => {
      const result = helper.calculateDepositDetails(60, 50);
      expect(result.depositAmount).toBe(30.0);
      expect(result.appliedPercent).toBe(50);
      expect(result.isFullUpfront).toBe(false);
      expect(helper.calculateDeposit(60, 50)).toBe(30.0);
    });

    it('should apply safety floor of R$ 15.00 for service of R$ 20.00 -> R$ 15.00 (instead of R$ 10.00)', () => {
      const result = helper.calculateDepositDetails(20, 50);
      expect(result.depositAmount).toBe(15.0);
      expect(result.appliedPercent).toBe(50);
      expect(helper.calculateDeposit(20, 50)).toBe(15.0);
    });

    it('should calculate 30% deposit for high-ticket service of R$ 500.00 -> R$ 150.00', () => {
      const result = helper.calculateDepositDetails(500, 30);
      expect(result.depositAmount).toBe(150.0);
      expect(result.appliedPercent).toBe(30);
      expect(helper.calculateDeposit(500, 30)).toBe(150.0);
    });

    it('should calculate 50% deposit for high-ticket service of R$ 500.00 when configured 50% -> R$ 250.00', () => {
      const result = helper.calculateDepositDetails(500, 50);
      expect(result.depositAmount).toBe(250.0);
      expect(result.appliedPercent).toBe(50);
      expect(helper.calculateDeposit(500, 50)).toBe(250.0);
    });

    it('should ignore 30% configuration and enforce 50% for services below R$ 400.00 (e.g. R$ 200.00 -> R$ 100.00)', () => {
      const result = helper.calculateDepositDetails(200, 30);
      expect(result.depositAmount).toBe(100.0);
      expect(result.appliedPercent).toBe(50);
      expect(helper.calculateDeposit(200, 30)).toBe(100.0);
    });
  });

  describe('getAvailableBlocks', () => {
    it('should return [100] for services below R$ 15.00', () => {
      expect(helper.getAvailableBlocks(10, 50)).toEqual([100]);
    });

    it('should return [30] for high-ticket services configured with 30%', () => {
      expect(helper.getAvailableBlocks(500, 30)).toEqual([30]);
    });

    it('should return [50] for standard services', () => {
      expect(helper.getAvailableBlocks(60, 50)).toEqual([50]);
      expect(helper.getAvailableBlocks(200, 30)).toEqual([50]);
    });
  });
});
