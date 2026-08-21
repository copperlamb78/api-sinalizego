import { Test, TestingModule } from '@nestjs/testing';
import { CalculateDeposit } from './calculate-deposit.helper';
import { MIN_MICROTRANSACTION_DEPOSIT } from '../common/constants/billing.constant';

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

  describe('Micro-Transaction Safety Gate (R$ 15.00 Threshold)', () => {
    it('should return 0 when totalPrice is 0 or negative', () => {
      expect(helper.calculateDeposit(0, 50)).toBe(0);
      expect(helper.calculateDeposit(-10, 50)).toBe(0);
    });

    it('should override to 100% upfront when calculated deposit is lower than R$ 15.00', () => {
      // Serviço R$ 40,00 com 25% de sinal = R$ 10,00 (< R$ 15,00) -> Força 100% (R$ 40,00)
      const result = helper.calculateDepositDetails(40, 25);
      expect(result.depositAmount).toBe(40.0);
      expect(result.isFullUpfront).toBe(true);
      expect(result.appliedPercent).toBe(100);
      expect(helper.calculateDeposit(40, 25)).toBe(40.0);
    });

    it('should override to 100% upfront for small services below R$ 15.00 regardless of percent', () => {
      // Serviço de R$ 12,00 -> Força R$ 12,00
      const result = helper.calculateDepositDetails(12, 50);
      expect(result.depositAmount).toBe(12.0);
      expect(result.isFullUpfront).toBe(true);
    });

    it('should maintain partial deposit when calculated deposit meets or exceeds R$ 15.00', () => {
      // Serviço R$ 60,00 com 25% de sinal = R$ 15,00 (Exatamente o limite) -> R$ 15,00
      const exactResult = helper.calculateDepositDetails(60, 25);
      expect(exactResult.depositAmount).toBe(15.0);
      expect(exactResult.isFullUpfront).toBe(false);
      expect(exactResult.appliedPercent).toBe(25);

      // Serviço R$ 100,00 com 30% de sinal = R$ 30,00 (> R$ 15,00) -> R$ 30,00
      const result = helper.calculateDepositDetails(100, 30);
      expect(result.depositAmount).toBe(30.0);
      expect(result.isFullUpfront).toBe(false);
      expect(result.appliedPercent).toBe(30);
    });

    it('should support client selected higher deposit percentage', () => {
      // Serviço R$ 100,00, empresa pede 25% (R$ 25,00), mas cliente escolhe 50% -> R$ 50,00
      const result = helper.calculateDepositDetails(100, 25, 50);
      expect(result.depositAmount).toBe(50.0);
      expect(result.appliedPercent).toBe(50);
      expect(result.isFullUpfront).toBe(false);
    });

    it('should fallback to company percent if client tries to select lower percentage than allowed', () => {
      // Empresa exige 50%, cliente tenta passar 20% -> Utiliza 50%
      const result = helper.calculateDepositDetails(100, 50, 20);
      expect(result.depositAmount).toBe(50.0);
      expect(result.appliedPercent).toBe(50);
    });
  });
});
