import { Test, TestingModule } from '@nestjs/testing';
import { CalculateDeposit } from './calculate-deposit.helper';
import { BadRequestException } from '@nestjs/common';

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

  describe('getAvailableBlocks', () => {
    it('should return [100] for services priced below R$ 15.00', () => {
      expect(helper.getAvailableBlocks(12, 25)).toEqual([100]);
      expect(helper.getAvailableBlocks(0, 25)).toEqual([100]);
      expect(helper.getAvailableBlocks(-5, 50)).toEqual([100]);
    });

    it('should return all baseline blocks when all meet >= R$ 15.00', () => {
      // R$ 100 com piso 25%: 25%=25, 50%=50, 75%=75, 100%=100 (todos >= 15)
      expect(helper.getAvailableBlocks(100, 25)).toEqual([25, 50, 75, 100]);
      // R$ 100 com piso 50%: 50%=50, 75%=75, 100%=100
      expect(helper.getAvailableBlocks(100, 50)).toEqual([50, 75, 100]);
    });

    it('should dynamically discard blocks that result in monetary value < R$ 15.00', () => {
      // R$ 40 com piso 25%: 25%=10 (<15 descartado), 50%=20, 75%=30, 100%=40
      expect(helper.getAvailableBlocks(40, 25)).toEqual([50, 75, 100]);
      // R$ 20 com piso 25%: 25%=5 (<15), 50%=10 (<15), 75%=15 (>=15), 100%=20
      expect(helper.getAvailableBlocks(20, 25)).toEqual([75, 100]);
      // R$ 16 com piso 25%: 25%=4 (<15), 50%=8 (<15), 75%=12 (<15), 100%=16
      expect(helper.getAvailableBlocks(16, 25)).toEqual([100]);
    });
  });

  describe('calculateDepositDetails & calculateDeposit', () => {
    it('should return 0 when totalPrice is 0 or negative', () => {
      expect(helper.calculateDeposit(0, 25)).toBe(0);
      expect(helper.calculateDeposit(-10, 50)).toBe(0);
    });

    it('should strictly enforce 100% upfront for services below R$ 15.00', () => {
      const result = helper.calculateDepositDetails(12.5, 25);
      expect(result.depositAmount).toBe(12.5);
      expect(result.appliedPercent).toBe(100);
      expect(result.isFullUpfront).toBe(true);
      expect(helper.calculateDeposit(12.5, 25)).toBe(12.5);
    });

    it('should calculate correct deposit for valid blocks in R$ 100 service', () => {
      // Default (não informado) -> aplica menor bloco disponível (25% = R$ 25,00)
      expect(helper.calculateDeposit(100, 25)).toBe(25.0);

      // Cliente escolhe 50% -> R$ 50,00
      expect(helper.calculateDeposit(100, 25, 50)).toBe(50.0);

      // Cliente escolhe 75% -> R$ 75,00
      expect(helper.calculateDeposit(100, 25, 75)).toBe(75.0);

      // Cliente escolhe 100% -> R$ 100,00
      const full = helper.calculateDepositDetails(100, 25, 100);
      expect(full.depositAmount).toBe(100.0);
      expect(full.isFullUpfront).toBe(true);
    });

    it('should default to smallest valid block >= R$ 15 when default floor is below R$ 15', () => {
      // Serviço R$ 40 com piso 25% (R$ 10 < 15): menor bloco válido disponível é 50% (R$ 20,00)
      const result = helper.calculateDepositDetails(40, 25);
      expect(result.depositAmount).toBe(20.0);
      expect(result.appliedPercent).toBe(50);
    });

    it('should throw BadRequestException if client attempts to select a block generating < R$ 15.00', () => {
      // Serviço de R$ 40: 25% resulta em R$ 10,00 (< R$ 15,00) -> Rejeita
      expect(() => helper.calculateDepositDetails(40, 25, 25)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if client selects percent lower than configured floor', () => {
      // Serviço R$ 100 com piso de 50%: cliente tenta passar 25% -> Rejeita
      expect(() => helper.calculateDepositDetails(100, 50, 25)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if client selects invalid non-block percent', () => {
      // Serviço R$ 100 com piso 25%: cliente tenta passar 30% -> Rejeita
      expect(() => helper.calculateDepositDetails(100, 25, 30)).toThrow(
        BadRequestException,
      );
    });
  });
});
