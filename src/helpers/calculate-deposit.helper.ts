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
   * Calcula os detalhes do sinal de reserva com base nas regras:
   * 1. Regra Padrão (Serviços < R$ 400,00): Sinal de 50% fixo com piso mínimo de R$ 15,00 (ou 100% se preço < R$ 15,00).
   * 2. Regra de Alto Ticket (Serviços >= R$ 400,00): Sinal de 30% ou 50% conforme configurado no serviço.
   */
  calculateDepositDetails(
    totalPrice: number,
    serviceDepositPercent?: number,
  ): DepositCalculationResult {
    if (totalPrice <= 0) {
      return {
        depositAmount: 0,
        isFullUpfront: true,
        appliedPercent: 100,
      };
    }

    // Regra: se o preço total for menor que o piso de microtransações (R$ 15,00), cobra 100% upfront
    if (totalPrice < MIN_MICROTRANSACTION_DEPOSIT) {
      return {
        depositAmount: Number(totalPrice.toFixed(2)),
        isFullUpfront: true,
        appliedPercent: 100,
      };
    }

    // Se totalPrice >= 400 e configurado 30%, aplica 30%. Caso contrário, 50%.
    const percentage =
      totalPrice >= 400 && serviceDepositPercent === 30 ? 0.3 : 0.5;
    const appliedPercent = percentage === 0.3 ? 30 : 50;

    const calculatedDeposit = Math.round(totalPrice * percentage * 100) / 100;
    const minDeposit = Math.min(totalPrice, MIN_MICROTRANSACTION_DEPOSIT);
    const depositAmount = Number(
      Math.max(calculatedDeposit, minDeposit).toFixed(2),
    );

    return {
      depositAmount,
      isFullUpfront: depositAmount >= totalPrice,
      appliedPercent,
    };
  }

  /**
   * Retorna apenas o valor numérico em Reais do sinal calculado.
   */
  calculateDeposit(totalPrice: number, serviceDepositPercent?: number): number {
    return this.calculateDepositDetails(totalPrice, serviceDepositPercent)
      .depositAmount;
  }

  /**
   * Retorna os blocos válidos para exibição informativa na vitrine.
   */
  getAvailableBlocks(
    totalPrice: number,
    serviceDepositPercent?: number,
  ): number[] {
    if (totalPrice <= 0 || totalPrice < MIN_MICROTRANSACTION_DEPOSIT) {
      return [100];
    }
    if (totalPrice >= 400 && serviceDepositPercent === 30) {
      return [30];
    }
    return [50];
  }
}
