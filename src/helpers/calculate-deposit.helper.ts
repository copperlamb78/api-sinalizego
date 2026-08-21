import { BadRequestException, Injectable } from '@nestjs/common';
import { MIN_MICROTRANSACTION_DEPOSIT } from '../common/constants/billing.constant';

export interface DepositCalculationResult {
  depositAmount: number;
  isFullUpfront: boolean;
  appliedPercent: number;
  availableBlocks: number[];
}

@Injectable()
export class CalculateDeposit {
  /**
   * Retorna os blocos de porcentagem disponíveis para um serviço com base no piso configurado (25% ou 50%)
   * e no valor monetário mínimo de R$ 15,00 (Trava de Microtransações).
   */
  getAvailableBlocks(totalPrice: number, configuredFloor: number): number[] {
    if (totalPrice <= 0 || totalPrice < MIN_MICROTRANSACTION_DEPOSIT) {
      return [100];
    }

    // Blocos baseline progressivos a partir do piso (25% ou 50%)
    const baselineBlocks = [25, 50, 75, 100].filter(
      (block) => block >= configuredFloor,
    );

    // Filtra blocos fracionários cujo valor monetário resultante seja >= R$ 15,00. 100% é sempre válido.
    const validBlocks = baselineBlocks.filter((block) => {
      if (block === 100) return true;
      const amount = (totalPrice * block) / 100;
      return amount >= MIN_MICROTRANSACTION_DEPOSIT;
    });

    return validBlocks.length > 0 ? validBlocks : [100];
  }

  /**
   * Valida a seleção do cliente e calcula o valor do sinal com base nos blocos e regras de microtransações.
   */
  calculateDepositDetails(
    totalPrice: number,
    configuredFloor: number,
    clientSelectedPercent?: number,
  ): DepositCalculationResult {
    if (totalPrice <= 0) {
      return {
        depositAmount: 0,
        isFullUpfront: true,
        appliedPercent: 100,
        availableBlocks: [100],
      };
    }

    // Regra: se o preço total do serviço for menor que R$ 15,00, força 100% upfront
    if (totalPrice < MIN_MICROTRANSACTION_DEPOSIT) {
      return {
        depositAmount: Number(totalPrice.toFixed(2)),
        isFullUpfront: true,
        appliedPercent: 100,
        availableBlocks: [100],
      };
    }

    const availableBlocks = this.getAvailableBlocks(totalPrice, configuredFloor);

    let appliedPercent: number;

    if (clientSelectedPercent !== undefined) {
      // Validação: não pode ser inferior ao piso configurado
      if (clientSelectedPercent < configuredFloor) {
        throw new BadRequestException(
          `A porcentagem de sinal não pode ser inferior ao mínimo exigido pela empresa (${configuredFloor}%).`,
        );
      }

      // Validação: deve pertencer aos blocos válidos que resultam em >= R$ 15,00
      if (!availableBlocks.includes(clientSelectedPercent)) {
        const candidateAmount = (totalPrice * clientSelectedPercent) / 100;
        if (candidateAmount < MIN_MICROTRANSACTION_DEPOSIT) {
          throw new BadRequestException(
            `O valor de sinal para o bloco de ${clientSelectedPercent}% (R$ ${candidateAmount.toFixed(2)}) é inferior ao mínimo permitido de R$ ${MIN_MICROTRANSACTION_DEPOSIT.toFixed(2)}. Opções disponíveis: ${availableBlocks.join('%, ')}%.`,
          );
        }
        throw new BadRequestException(
          `A porcentagem de sinal (${clientSelectedPercent}%) não é um bloco válido. Opções disponíveis: ${availableBlocks.join('%, ')}%.`,
        );
      }

      appliedPercent = clientSelectedPercent;
    } else {
      // Se não informado, aplica o menor bloco disponível que atenda ao piso de R$ 15,00
      appliedPercent = availableBlocks[0];
    }

    const depositAmount = Number(
      ((totalPrice * appliedPercent) / 100).toFixed(2),
    );

    return {
      depositAmount,
      isFullUpfront: appliedPercent === 100,
      appliedPercent,
      availableBlocks,
    };
  }

  /**
   * Retorna apenas o valor numérico em Reais do sinal calculado com a trava de microtransações.
   */
  calculateDeposit(
    totalPrice: number,
    configuredFloor: number,
    clientSelectedPercent?: number,
  ): number {
    return this.calculateDepositDetails(
      totalPrice,
      configuredFloor,
      clientSelectedPercent,
    ).depositAmount;
  }
}

