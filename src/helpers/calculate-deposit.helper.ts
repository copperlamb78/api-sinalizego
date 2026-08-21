import { Injectable } from '@nestjs/common';
import { MIN_MICROTRANSACTION_DEPOSIT } from '../common/constants/billing.constant';

export interface DepositCalculationResult {
  depositAmount: number;
  isFullUpfront: boolean;
  appliedPercent: number;
}

@Injectable()
export class CalculateDeposit {
  /**
   * Calcula o valor de sinal a ser pago online aplicando a trava de microtransações (Safety Gate de R$ 15,00).
   * Se o valor resultante da porcentagem for inferior a R$ 15,00, força 100% upfront payment.
   */
  calculateDepositDetails(
    totalPrice: number,
    configuredPercent: number,
    clientSelectedPercent?: number,
  ): DepositCalculationResult {
    if (totalPrice <= 0) {
      return {
        depositAmount: 0,
        isFullUpfront: true,
        appliedPercent: 100,
      };
    }

    const targetPercent =
      clientSelectedPercent !== undefined &&
      clientSelectedPercent >= configuredPercent
        ? clientSelectedPercent
        : configuredPercent;

    const candidateDeposit = (totalPrice * targetPercent) / 100;

    // Safety Gate de Microtransações: R$ 15,00
    if (candidateDeposit < MIN_MICROTRANSACTION_DEPOSIT) {
      return {
        depositAmount: Number(totalPrice.toFixed(2)),
        isFullUpfront: true,
        appliedPercent: 100,
      };
    }

    return {
      depositAmount: Number(candidateDeposit.toFixed(2)),
      isFullUpfront: targetPercent >= 100,
      appliedPercent: targetPercent,
    };
  }

  /**
   * Retorna apenas o valor numérico em Reais do sinal calculado com a trava de microtransações.
   */
  calculateDeposit(
    totalPrice: number,
    configuredPercent: number,
    clientSelectedPercent?: number,
  ): number {
    return this.calculateDepositDetails(
      totalPrice,
      configuredPercent,
      clientSelectedPercent,
    ).depositAmount;
  }
}
