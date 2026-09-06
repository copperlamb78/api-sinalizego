import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  FeeOverride,
  FeeOverrideSource,
  FeeOverrideStatus,
} from '@prisma/client';
import {
  BARBER_ASAAS_PIX_FEE,
  MIN_PROMO_BARBER_FEE,
} from '../../common/constants/billing.constant';
import { PrismaService } from '../../prisma/prisma.service';

export interface EffectiveFeeResult {
  fee: number;
  overrideId?: string;
  isPromotional: boolean;
}

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna a taxa efetiva do barbeiro no split Pix para a empresa informada.
   * Busca overrides ativos no instante informado (padrão: agora).
   * Nunca devolve valor inferior a MIN_PROMO_BARBER_FEE (R$ 0,49).
   */
  async getEffectiveBarberFee(
    companyId: string,
    at: Date = new Date(),
  ): Promise<EffectiveFeeResult> {
    const activeOverrides = await this.prisma.feeOverride.findMany({
      where: {
        companyId,
        status: FeeOverrideStatus.ACTIVE,
        startsAt: { lte: at },
        endsAt: { gte: at },
      },
      orderBy: { barberPixFee: 'asc' },
    });

    if (activeOverrides.length === 0) {
      return {
        fee: BARBER_ASAAS_PIX_FEE,
        isPromotional: false,
      };
    }

    const bestOverride = activeOverrides[0];
    const rawFee = Number(bestOverride.barberPixFee);
    const finalFee = Math.max(MIN_PROMO_BARBER_FEE, rawFee);

    return {
      fee: Number(finalFee.toFixed(2)),
      overrideId: bestOverride.id,
      isPromotional: true,
    };
  }

  /**
   * Cria um novo override de taxa para uma empresa.
   */
  async createOverride(data: {
    companyId: string;
    barberPixFee: number;
    startsAt: Date;
    endsAt: Date;
    source: FeeOverrideSource;
    sourceId?: string;
    status?: FeeOverrideStatus;
  }): Promise<FeeOverride> {
    const clampedFee = Math.max(MIN_PROMO_BARBER_FEE, data.barberPixFee);

    return this.prisma.feeOverride.create({
      data: {
        companyId: data.companyId,
        barberPixFee: clampedFee,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        source: data.source,
        sourceId: data.sourceId,
        status: data.status ?? FeeOverrideStatus.ACTIVE,
      },
    });
  }

  /**
   * Revoga um override de taxa existente.
   */
  async revokeOverride(
    overrideId: string,
    revokedReason: string,
  ): Promise<FeeOverride> {
    return this.prisma.feeOverride.update({
      where: { id: overrideId },
      data: {
        status: FeeOverrideStatus.REVOKED,
        revokedReason,
      },
    });
  }

  /**
   * Cron diário para expirar overrides vencidos e ativar overrides enfileirados (QUEUED).
   * Executa diariamente às 00:05 (horário de Brasília).
   */
  @Cron('5 0 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleExpiredOverrides(): Promise<void> {
    const now = new Date();

    const expiredResult = await this.prisma.feeOverride.updateMany({
      where: {
        status: FeeOverrideStatus.ACTIVE,
        endsAt: { lt: now },
      },
      data: {
        status: FeeOverrideStatus.EXPIRED,
      },
    });

    if (expiredResult.count > 0) {
      this.logger.log(
        `[Cron Overrides] ${expiredResult.count} overrides expirados com sucesso.`,
      );
    }

    // Ativa overrides que estavam enfileirados (QUEUED) para empresas sem override ativo
    const queuedOverrides = await this.prisma.feeOverride.findMany({
      where: {
        status: FeeOverrideStatus.QUEUED,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const queued of queuedOverrides) {
      const activeCount = await this.prisma.feeOverride.count({
        where: {
          companyId: queued.companyId,
          status: FeeOverrideStatus.ACTIVE,
          endsAt: { gte: now },
        },
      });

      if (activeCount === 0) {
        const durationMs = queued.endsAt.getTime() - queued.startsAt.getTime();
        const newStartsAt = now;
        const newEndsAt = new Date(now.getTime() + durationMs);

        await this.prisma.feeOverride.update({
          where: { id: queued.id },
          data: {
            status: FeeOverrideStatus.ACTIVE,
            startsAt: newStartsAt,
            endsAt: newEndsAt,
          },
        });

        this.logger.log(
          `[Cron Overrides] Override enfileirado #${queued.id} ativado para empresa ${queued.companyId}. Validade até ${newEndsAt.toISOString()}.`,
        );
      }
    }
  }
}
