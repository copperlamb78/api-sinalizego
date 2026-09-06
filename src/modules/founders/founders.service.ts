import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  FeeOverrideSource,
  FeeOverrideStatus,
  FounderSeatStatus,
  WaitlistStatus,
} from '@prisma/client';
import {
  FOUNDERS_DURATION_DAYS,
  FOUNDERS_MAX_SEATS,
  FOUNDERS_MONTH1_TARGET,
  FOUNDERS_MONTH2_TARGET,
  FOUNDERS_PROVING_DAYS,
  FOUNDERS_RESERVE_DAYS,
  FOUNDERS_WAITLIST_OFFER_DAYS,
} from '../../common/constants/billing.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { FeesService } from '../fees/fees.service';
import { CreateFounderDto } from './dto/create-founder.dto';

@Injectable()
export class FoundersService {
  private readonly logger = new Logger(FoundersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly feesService: FeesService,
  ) {}

  /**
   * Realiza a inscrição no Programa de Fundadores.
   * Aloca uma vaga OPEN (1..20) ou posiciona na lista de espera.
   */
  async registerFounder(dto: CreateFounderDto) {
    const now = new Date();

    // 1. Busca vagas ativas (não canceladas/perdidas)
    const activeSeats = await this.prisma.founderSeat.findMany({
      where: {
        status: {
          in: [
            FounderSeatStatus.RESERVED,
            FounderSeatStatus.SECURED,
            FounderSeatStatus.PROVING,
            FounderSeatStatus.ACTIVE,
          ],
        },
      },
      select: { seatNumber: true },
    });

    const activeSeatNumbers = new Set(activeSeats.map((s) => s.seatNumber));

    // Se houver vaga livre entre as 20
    if (activeSeats.length < FOUNDERS_MAX_SEATS) {
      let allocatedSeatNumber = 1;
      for (let i = 1; i <= FOUNDERS_MAX_SEATS; i++) {
        if (!activeSeatNumbers.has(i)) {
          allocatedSeatNumber = i;
          break;
        }
      }

      // Cria usuário e empresa
      const companyResult =
        await this.companyService.createCompanyWithUser(dto);
      const companyId = companyResult.user.companies[0].id;

      const reserveExpiresAt = new Date(
        now.getTime() + FOUNDERS_RESERVE_DAYS * 24 * 60 * 60 * 1000,
      );

      const founderSeat = await this.prisma.founderSeat.create({
        data: {
          seatNumber: allocatedSeatNumber,
          companyId,
          status: FounderSeatStatus.RESERVED,
          reservedAt: now,
          reserveExpiresAt,
          surveyConsentAt: now,
        },
      });

      this.logger.log(
        `[Fundadores] Empresa #${companyId} reservou a vaga de Fundador #${allocatedSeatNumber}. Prazo de aprovação até ${reserveExpiresAt.toISOString()}.`,
      );

      return {
        ...companyResult,
        founder: {
          seatNumber: founderSeat.seatNumber,
          status: founderSeat.status,
          reserveExpiresAt: founderSeat.reserveExpiresAt,
        },
      };
    }

    // Caso as 20 vagas estejam ocupadas, entra na lista de espera (máximo de 10 posições)
    const waitlistCount = await this.prisma.founderWaitlist.count({
      where: {
        status: { in: [WaitlistStatus.WAITING, WaitlistStatus.OFFERED] },
      },
    });

    if (waitlistCount >= 10) {
      throw new BadRequestException(
        'O Programa de Fundadores e a lista de espera atingiram a capacidade máxima.',
      );
    }

    const companyResult = await this.companyService.createCompanyWithUser(dto);
    const companyId = companyResult.user.companies[0].id;

    const waitlistEntry = await this.prisma.founderWaitlist.create({
      data: {
        position: waitlistCount + 1,
        companyId,
        status: WaitlistStatus.WAITING,
      },
    });

    this.logger.log(
      `[Fundadores] Empresa #${companyId} entrou na lista de espera na posição #${waitlistEntry.position}.`,
    );

    return {
      ...companyResult,
      waitlist: {
        position: waitlistEntry.position,
        status: waitlistEntry.status,
      },
    };
  }

  /**
   * Retorna informações públicas sobre o total de vagas e disponibilidade.
   */
  async getVacanciesInfo() {
    const activeSeatsCount = await this.prisma.founderSeat.count({
      where: {
        status: {
          in: [
            FounderSeatStatus.RESERVED,
            FounderSeatStatus.SECURED,
            FounderSeatStatus.PROVING,
            FounderSeatStatus.ACTIVE,
          ],
        },
      },
    });

    const waitlistCount = await this.prisma.founderWaitlist.count({
      where: {
        status: { in: [WaitlistStatus.WAITING, WaitlistStatus.OFFERED] },
      },
    });

    return {
      totalSeats: FOUNDERS_MAX_SEATS,
      occupiedSeats: activeSeatsCount,
      availableSeats: Math.max(0, FOUNDERS_MAX_SEATS - activeSeatsCount),
      waitlistCount,
      isOpen: activeSeatsCount < FOUNDERS_MAX_SEATS || waitlistCount < 10,
    };
  }

  /**
   * Retorna o status e acompanhamento de metas para o dono da barbearia.
   */
  async getFounderStatus(companyId: string) {
    const seat = await this.prisma.founderSeat.findUnique({
      where: { companyId },
    });

    if (seat) {
      let overrideEndsAt: Date | null = null;
      if (seat.feeOverrideId) {
        const override = await this.prisma.feeOverride.findUnique({
          where: { id: seat.feeOverrideId },
        });
        overrideEndsAt = override?.endsAt || null;
      }

      return {
        type: 'SEAT',
        seatNumber: seat.seatNumber,
        status: seat.status,
        reservedAt: seat.reservedAt,
        reserveExpiresAt: seat.reserveExpiresAt,
        securedAt: seat.securedAt,
        activatedAt: seat.activatedAt,
        provingEndsAt: seat.provingEndsAt,
        month1: {
          target: seat.month1Target,
          count: seat.month1Count,
          passed: seat.month1Passed,
          evaluatedAt: seat.month1EvaluatedAt,
        },
        month2: {
          target: seat.month2Target,
          count: seat.month2Count,
          passed: seat.month2Passed,
          evaluatedAt: seat.month2EvaluatedAt,
        },
        forfeitedAt: seat.forfeitedAt,
        forfeitReason: seat.forfeitReason,
        overrideEndsAt,
      };
    }

    const waitlist = await this.prisma.founderWaitlist.findUnique({
      where: { companyId },
    });

    if (waitlist) {
      return {
        type: 'WAITLIST',
        position: waitlist.position,
        status: waitlist.status,
        offeredAt: waitlist.offeredAt,
        offerExpiresAt: waitlist.offerExpiresAt,
      };
    }

    return null;
  }

  /**
   * Chamado quando o Asaas aprova a subconta do estabelecimento.
   * Promove o FounderSeat de RESERVED para SECURED e cria o FeeOverride.
   */
  async onSubaccountApproved(companyId: string): Promise<void> {
    const seat = await this.prisma.founderSeat.findUnique({
      where: { companyId },
    });

    if (!seat || seat.status !== FounderSeatStatus.RESERVED) {
      return;
    }

    const now = new Date();
    if (now > seat.reserveExpiresAt) {
      // Prazo de reserva de 14 dias estourou
      await this.prisma.founderSeat.update({
        where: { id: seat.id },
        data: {
          status: FounderSeatStatus.FORFEITED,
          forfeitedAt: now,
          forfeitReason: 'RESERVE_EXPIRED',
        },
      });

      this.logger.warn(
        `[Fundadores] Reserva da vaga #${seat.seatNumber} para empresa #${companyId} expirou.`,
      );
      await this.offerNextInWaitlist(seat.seatNumber);
      return;
    }

    // Subconta aprovada dentro do prazo: SECURED
    const provisionalDurationMs = FOUNDERS_PROVING_DAYS * 24 * 60 * 60 * 1000;
    const provisionalEndsAt = new Date(now.getTime() + provisionalDurationMs);

    const override = await this.feesService.createOverride({
      companyId,
      barberPixFee: 0.49,
      startsAt: now,
      endsAt: provisionalEndsAt,
      source: FeeOverrideSource.FOUNDER,
      sourceId: seat.id,
      status: FeeOverrideStatus.ACTIVE,
    });

    await this.prisma.founderSeat.update({
      where: { id: seat.id },
      data: {
        status: FounderSeatStatus.SECURED,
        securedAt: now,
        feeOverrideId: override.id,
      },
    });

    this.logger.log(
      `[Fundadores] Vaga #${seat.seatNumber} garantida (SECURED) para empresa #${companyId}. Override #${override.id} ativado.`,
    );
  }

  /**
   * Chamado quando a empresa conclui seu primeiro agendamento COMPLETED.
   * Promove de SECURED para PROVING e fixa a vigência total de 365 dias do override.
   */
  async onAppointmentCompleted(companyId: string): Promise<void> {
    const seat = await this.prisma.founderSeat.findUnique({
      where: { companyId },
    });

    if (!seat || seat.status !== FounderSeatStatus.SECURED) {
      return;
    }

    const now = new Date();
    const provingEndsAt = new Date(
      now.getTime() + FOUNDERS_PROVING_DAYS * 24 * 60 * 60 * 1000,
    );
    const fullDurationEndsAt = new Date(
      now.getTime() + FOUNDERS_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    // Atualiza o override existente para 365 dias a partir da ativação
    if (seat.feeOverrideId) {
      await this.prisma.feeOverride.update({
        where: { id: seat.feeOverrideId },
        data: {
          endsAt: fullDurationEndsAt,
        },
      });
    }

    await this.prisma.founderSeat.update({
      where: { id: seat.id },
      data: {
        status: FounderSeatStatus.PROVING,
        activatedAt: now,
        provingEndsAt,
      },
    });

    this.logger.log(
      `[Fundadores] Empresa #${companyId} ativou a vaga #${seat.seatNumber} (PROVING). Janela de metas correndo até ${provingEndsAt.toISOString()}.`,
    );
  }

  /**
   * Aceite de vaga oferecida da lista de espera.
   */
  async acceptWaitlistOffer(companyId: string) {
    const waitlist = await this.prisma.founderWaitlist.findUnique({
      where: { companyId },
    });

    if (!waitlist || waitlist.status !== WaitlistStatus.OFFERED) {
      throw new BadRequestException(
        'Nenhuma oferta pendente de vaga para esta empresa.',
      );
    }

    const now = new Date();
    if (waitlist.offerExpiresAt && now > waitlist.offerExpiresAt) {
      await this.prisma.founderWaitlist.update({
        where: { id: waitlist.id },
        data: { status: WaitlistStatus.EXPIRED },
      });
      throw new BadRequestException('O prazo de aceite da vaga expirou.');
    }

    // Busca o menor seatNumber sem ocupante ativo
    const activeSeats = await this.prisma.founderSeat.findMany({
      where: {
        status: {
          in: [
            FounderSeatStatus.RESERVED,
            FounderSeatStatus.SECURED,
            FounderSeatStatus.PROVING,
            FounderSeatStatus.ACTIVE,
          ],
        },
      },
      select: { seatNumber: true },
    });

    const activeNumbers = new Set(activeSeats.map((s) => s.seatNumber));
    let seatNumber = 1;
    for (let i = 1; i <= FOUNDERS_MAX_SEATS; i++) {
      if (!activeNumbers.has(i)) {
        seatNumber = i;
        break;
      }
    }

    const reserveExpiresAt = new Date(
      now.getTime() + FOUNDERS_RESERVE_DAYS * 24 * 60 * 60 * 1000,
    );

    const seat = await this.prisma.founderSeat.create({
      data: {
        seatNumber,
        companyId,
        status: FounderSeatStatus.RESERVED,
        reservedAt: now,
        reserveExpiresAt,
        surveyConsentAt: now,
      },
    });

    await this.prisma.founderWaitlist.update({
      where: { id: waitlist.id },
      data: { status: WaitlistStatus.ACCEPTED },
    });

    return {
      message: 'Vaga de Fundador aceita com sucesso!',
      seatNumber: seat.seatNumber,
      status: seat.status,
      reserveExpiresAt: seat.reserveExpiresAt,
    };
  }

  /**
   * Oferece uma vaga liberada ao próximo da lista de espera.
   */
  private async offerNextInWaitlist(seatNumber: number): Promise<void> {
    const nextCandidate = await this.prisma.founderWaitlist.findFirst({
      where: { status: WaitlistStatus.WAITING },
      orderBy: { position: 'asc' },
    });

    if (!nextCandidate) {
      this.logger.log(
        `[Fundadores] Vaga #${seatNumber} liberada, mas não há candidatos na lista de espera.`,
      );
      return;
    }

    const now = new Date();
    const offerExpiresAt = new Date(
      now.getTime() + FOUNDERS_WAITLIST_OFFER_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.founderWaitlist.update({
      where: { id: nextCandidate.id },
      data: {
        status: WaitlistStatus.OFFERED,
        offeredAt: now,
        offerExpiresAt,
      },
    });

    this.logger.log(
      `[Fundadores] Vaga #${seatNumber} oferecida à empresa #${nextCandidate.companyId} (lista de espera). Prazo até ${offerExpiresAt.toISOString()}.`,
    );
  }

  /**
   * Cron diário de avaliação de reservas, metas e lista de espera.
   * Roda diariamente às 04:00 (horário de Brasília).
   */
  @Cron('0 4 * * *', { timeZone: 'America/Sao_Paulo' })
  async evaluateFoundersCron(): Promise<void> {
    const now = new Date();

    // 1. Reservas vencidas (> 14 dias sem subconta aprovada)
    const expiredReservations = await this.prisma.founderSeat.findMany({
      where: {
        status: FounderSeatStatus.RESERVED,
        reserveExpiresAt: { lt: now },
      },
    });

    for (const seat of expiredReservations) {
      await this.prisma.founderSeat.update({
        where: { id: seat.id },
        data: {
          status: FounderSeatStatus.FORFEITED,
          forfeitedAt: now,
          forfeitReason: 'RESERVE_EXPIRED',
        },
      });

      this.logger.log(
        `[Cron Fundadores] Reserva da vaga #${seat.seatNumber} expirou para empresa #${seat.companyId}. Repassando para a fila.`,
      );
      await this.offerNextInWaitlist(seat.seatNumber);
    }

    // 2. Avaliação de metas de empresas em PROVING
    const provingSeats = await this.prisma.founderSeat.findMany({
      where: {
        status: FounderSeatStatus.PROVING,
      },
    });

    for (const seat of provingSeats) {
      if (!seat.activatedAt) continue;

      const activatedAt = seat.activatedAt;
      const month1End = new Date(
        activatedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
      );
      const month2End = new Date(
        activatedAt.getTime() + 60 * 24 * 60 * 60 * 1000,
      );

      // Avaliação do Mês 1
      if (now >= month1End && seat.month1EvaluatedAt === null) {
        const count = await this.prisma.appointment.count({
          where: {
            companyId: seat.companyId,
            status: 'COMPLETED',
            appointmentDate: {
              gte: activatedAt,
              lt: month1End,
            },
          },
        });

        const passed = count >= FOUNDERS_MONTH1_TARGET;
        if (!passed) {
          await this.prisma.founderSeat.update({
            where: { id: seat.id },
            data: {
              status: FounderSeatStatus.FORFEITED,
              month1Count: count,
              month1Passed: false,
              month1EvaluatedAt: now,
              forfeitedAt: now,
              forfeitReason: 'MONTH1_TARGET_NOT_MET',
            },
          });

          if (seat.feeOverrideId) {
            await this.feesService.revokeOverride(
              seat.feeOverrideId,
              'Meta de atendimentos do Mês 1 não atingida no Programa Fundadores.',
            );
          }

          this.logger.warn(
            `[Cron Fundadores] Empresa #${seat.companyId} perdeu a vaga #${seat.seatNumber} (Mês 1: ${count}/${FOUNDERS_MONTH1_TARGET}).`,
          );
          await this.offerNextInWaitlist(seat.seatNumber);
          continue;
        } else {
          await this.prisma.founderSeat.update({
            where: { id: seat.id },
            data: {
              month1Count: count,
              month1Passed: true,
              month1EvaluatedAt: now,
            },
          });
          this.logger.log(
            `[Cron Fundadores] Empresa #${seat.companyId} cumpriu a meta do Mês 1 (${count}/${FOUNDERS_MONTH1_TARGET}).`,
          );
        }
      }

      // Avaliação do Mês 2
      if (now >= month2End && seat.month2EvaluatedAt === null) {
        const count = await this.prisma.appointment.count({
          where: {
            companyId: seat.companyId,
            status: 'COMPLETED',
            appointmentDate: {
              gte: month1End,
              lt: month2End,
            },
          },
        });

        const passed = count >= FOUNDERS_MONTH2_TARGET;
        if (!passed) {
          await this.prisma.founderSeat.update({
            where: { id: seat.id },
            data: {
              status: FounderSeatStatus.FORFEITED,
              month2Count: count,
              month2Passed: false,
              month2EvaluatedAt: now,
              forfeitedAt: now,
              forfeitReason: 'MONTH2_TARGET_NOT_MET',
            },
          });

          if (seat.feeOverrideId) {
            await this.feesService.revokeOverride(
              seat.feeOverrideId,
              'Meta de atendimentos do Mês 2 não atingida no Programa Fundadores.',
            );
          }

          this.logger.warn(
            `[Cron Fundadores] Empresa #${seat.companyId} perdeu a vaga #${seat.seatNumber} (Mês 2: ${count}/${FOUNDERS_MONTH2_TARGET}).`,
          );
          await this.offerNextInWaitlist(seat.seatNumber);
        } else {
          await this.prisma.founderSeat.update({
            where: { id: seat.id },
            data: {
              status: FounderSeatStatus.ACTIVE,
              month2Count: count,
              month2Passed: true,
              month2EvaluatedAt: now,
            },
          });
          this.logger.log(
            `[Cron Fundadores] Empresa #${seat.companyId} concluiu a prova com sucesso e consolidou a vaga #${seat.seatNumber} (Mês 2: ${count}/${FOUNDERS_MONTH2_TARGET}).`,
          );
        }
      }
    }

    // 3. Ofertas de lista de espera expiradas (> 7 dias sem aceite)
    const expiredOffers = await this.prisma.founderWaitlist.findMany({
      where: {
        status: WaitlistStatus.OFFERED,
        offerExpiresAt: { lt: now },
      },
    });

    for (const offer of expiredOffers) {
      await this.prisma.founderWaitlist.update({
        where: { id: offer.id },
        data: { status: WaitlistStatus.EXPIRED },
      });

      this.logger.log(
        `[Cron Fundadores] Oferta da lista de espera para empresa #${offer.companyId} expirou. Buscando próximo candidato.`,
      );
      await this.offerNextInWaitlist(1);
    }
  }
}
