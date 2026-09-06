import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FeeOverrideSource,
  FeeOverrideStatus,
  FounderSeatStatus,
  Referral,
  ReferralStatus,
} from '@prisma/client';
import {
  REFERRAL_CYCLE_DAYS,
  REFERRAL_MAX_ANNUAL_DAYS,
  REFERRAL_PROMO_DAYS,
  SUPER_ADMIN_ALERT_EMAIL,
} from '../../common/constants/billing.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { FeesService } from '../fees/fees.service';
import { MailService } from '../mail/mail.service';

function generateReferralCode(): string {
  const chars = '23456789BCDFGHJKLMNPQRSTVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly feesService: FeesService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'https://app.sinalizego.com';
  }

  /**
   * Obtém ou cria o código exclusivo de indicação para a empresa.
   */
  async getOrCreateReferralCode(companyId: string) {
    let referralCode = await this.prisma.referralCode.findUnique({
      where: { referrerCompanyId: companyId },
    });

    if (!referralCode) {
      let code = generateReferralCode();
      // Garante unicidade do código
      while (await this.prisma.referralCode.findUnique({ where: { code } })) {
        code = generateReferralCode();
      }

      referralCode = await this.prisma.referralCode.create({
        data: {
          code,
          referrerCompanyId: companyId,
        },
      });
    }

    return {
      code: referralCode.code,
      link: `${this.frontendUrl}/cadastro?ref=${referralCode.code}`,
      active: referralCode.active,
      createdAt: referralCode.createdAt,
    };
  }

  /**
   * Vincula um código de indicação a uma empresa recém-criada.
   * Realiza checagens preliminares de risco (telefone, endereço).
   */
  async attachReferral(
    referredCompanyId: string,
    referralCodeStr?: string,
  ): Promise<Referral | null> {
    if (!referralCodeStr || referralCodeStr.trim().length === 0) {
      return null;
    }

    const cleanCode = referralCodeStr.trim().toUpperCase();
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code: cleanCode },
    });

    if (!referralCode || !referralCode.active) {
      this.logger.warn(
        `[Indicação] Código "${cleanCode}" inválido ou inativo para empresa #${referredCompanyId}. Ignorando.`,
      );
      return null;
    }

    if (referralCode.referrerCompanyId === referredCompanyId) {
      this.logger.warn(
        `[Indicação] Tentativa de auto-indicação da mesma empresa #${referredCompanyId}. Ignorando.`,
      );
      return null;
    }

    // Checa se a empresa já foi indicada antes
    const existingReferral = await this.prisma.referral.findUnique({
      where: { referredCompanyId },
    });
    if (existingReferral) {
      return existingReferral;
    }

    // Busca dados das duas empresas para checagem preliminar de risco
    const [referred, referrer] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: referredCompanyId },
        include: { owner: true },
      }),
      this.prisma.company.findUnique({
        where: { id: referralCode.referrerCompanyId },
        include: { owner: true },
      }),
    ]);

    const riskFlags: string[] = [];

    if (referred && referrer) {
      if (
        referred.owner?.phone &&
        referrer.owner?.phone &&
        referred.owner.phone === referrer.owner.phone
      ) {
        riskFlags.push('SAME_PHONE');
      }

      if (
        referred.zipCode &&
        referrer.zipCode &&
        referred.zipCode === referrer.zipCode &&
        referred.number &&
        referrer.number &&
        referred.number === referrer.number
      ) {
        riskFlags.push('SAME_ADDRESS');
      }
    }

    const initialStatus =
      riskFlags.length > 0 ? ReferralStatus.REVIEW : ReferralStatus.PENDING;

    const referral = await this.prisma.referral.create({
      data: {
        codeId: referralCode.id,
        referrerCompanyId: referralCode.referrerCompanyId,
        referredCompanyId,
        status: initialStatus,
        riskFlags,
      },
    });

    if (initialStatus === ReferralStatus.REVIEW && referred && referrer) {
      await this.mailService.sendReferralReviewAlertEmail(
        SUPER_ADMIN_ALERT_EMAIL,
        {
          referralId: referral.id,
          referrerName: referrer.businessName,
          referredName: referred.businessName,
          riskFlags,
        },
      );
    }

    return referral;
  }

  /**
   * Chamado quando o perfil financeiro/subconta do indicado é aprovado no Asaas.
   * Realiza validação de documentos contra auto-indicação e ativa a promoção.
   */
  async onSubaccountApproved(companyId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredCompanyId: companyId },
    });

    if (!referral) {
      return;
    }

    if (
      referral.status === ReferralStatus.ACTIVATED ||
      referral.status === ReferralStatus.REJECTED ||
      referral.status === ReferralStatus.REVOKED
    ) {
      return;
    }

    // Busca ambas as empresas com perfis financeiros para validação profunda
    const [referred, referrer] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: referral.referredCompanyId },
        include: { financialProfile: true, owner: true },
      }),
      this.prisma.company.findUnique({
        where: { id: referral.referrerCompanyId },
        include: { financialProfile: true, owner: true },
      }),
    ]);

    if (!referred || !referrer) {
      return;
    }

    const flags = [...referral.riskFlags];

    // Checa colisão de Chave Pix (conta bancária idêntica)
    if (
      referred.financialProfile?.pixAddressKey &&
      referrer.financialProfile?.pixAddressKey &&
      referred.financialProfile.pixAddressKey ===
        referrer.financialProfile.pixAddressKey
    ) {
      if (!flags.includes('SAME_PIX_KEY')) {
        flags.push('SAME_PIX_KEY');
      }
    }

    // Checa colisão de CPF/CNPJ financeiro
    if (
      referred.financialProfile?.cpfCnpj &&
      referrer.financialProfile?.cpfCnpj &&
      referred.financialProfile.cpfCnpj === referrer.financialProfile.cpfCnpj
    ) {
      if (!flags.includes('SAME_CPF_CNPJ')) {
        flags.push('SAME_CPF_CNPJ');
      }
    }

    // Checa colisão de CPF do usuário
    if (
      referred.owner?.cpfCnpj &&
      referrer.owner?.cpfCnpj &&
      referred.owner.cpfCnpj === referrer.owner.cpfCnpj
    ) {
      if (!flags.includes('SAME_USER_CPF')) {
        flags.push('SAME_USER_CPF');
      }
    }

    if (flags.length > 0) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: ReferralStatus.REVIEW,
          riskFlags: flags,
        },
      });

      await this.mailService.sendReferralReviewAlertEmail(
        SUPER_ADMIN_ALERT_EMAIL,
        {
          referralId: referral.id,
          referrerName: referrer.businessName,
          referredName: referred.businessName,
          riskFlags: flags,
        },
      );
      this.logger.warn(
        `[Indicação] Indicação #${referral.id} direcionada para REVIEW. Flags: ${flags.join(', ')}`,
      );
      return;
    }

    // Sem riscos detectados: ativa a promoção para ambos
    await this.activateReferral(referral);
  }

  /**
   * Ativa os benefícios da indicação para indicado e indicador.
   */
  async activateReferral(referral: Referral): Promise<void> {
    const now = new Date();
    const durationMs = REFERRAL_PROMO_DAYS * 24 * 60 * 60 * 1000;
    const recipientEndsAt = new Date(now.getTime() + durationMs);

    // 1. Override do indicado: 15 dias de taxa 0.49
    const recipientOverride = await this.feesService.createOverride({
      companyId: referral.referredCompanyId,
      barberPixFee: 0.49,
      startsAt: now,
      endsAt: recipientEndsAt,
      source: FeeOverrideSource.REFERRAL_RECIPIENT,
      sourceId: referral.id,
      status: FeeOverrideStatus.ACTIVE,
    });

    // 2. Apuração do teto anual do indicador (máx. 90 dias / 6 indicações no ciclo de 1 ano)
    const referrerActivatedReferrals = await this.prisma.referral.findMany({
      where: {
        referrerCompanyId: referral.referrerCompanyId,
        status: ReferralStatus.ACTIVATED,
        id: { not: referral.id },
      },
      orderBy: { activatedAt: 'asc' },
    });

    let cycleStart = now;
    if (referrerActivatedReferrals.length > 0) {
      const firstActivation = referrerActivatedReferrals[0].activatedAt || now;
      const cycleMs = REFERRAL_CYCLE_DAYS * 24 * 60 * 60 * 1000;
      if (now.getTime() - firstActivation.getTime() < cycleMs) {
        cycleStart = firstActivation;
      } else {
        // Se passou mais de 1 ano, um novo ciclo se inicia hoje
        cycleStart = now;
      }
    }

    const referralsInCycle = referrerActivatedReferrals.filter(
      (r) => r.activatedAt && r.activatedAt >= cycleStart,
    );

    let referrerOverrideId: string | undefined = undefined;

    // Teto de 6 indicações (90 dias) no ciclo anual
    const maxReferrals = REFERRAL_MAX_ANNUAL_DAYS / REFERRAL_PROMO_DAYS;
    if (referralsInCycle.length < maxReferrals) {
      // Indicador elegível a mais 15 dias
      // Checa se o indicador é um Fundador ativo
      const founderSeat = await this.prisma.founderSeat.findFirst({
        where: {
          companyId: referral.referrerCompanyId,
          status: {
            in: [
              FounderSeatStatus.SECURED,
              FounderSeatStatus.PROVING,
              FounderSeatStatus.ACTIVE,
            ],
          },
        },
      });

      if (founderSeat) {
        // Se for Fundador ativo, os 15 dias ficam enfileirados (QUEUED) para vigorar após o fim do ano de fundador
        const queuedOverride = await this.feesService.createOverride({
          companyId: referral.referrerCompanyId,
          barberPixFee: 0.49,
          startsAt: now,
          endsAt: new Date(now.getTime() + durationMs),
          source: FeeOverrideSource.REFERRAL_SENDER,
          sourceId: referral.id,
          status: FeeOverrideStatus.QUEUED,
        });
        referrerOverrideId = queuedOverride.id;
        this.logger.log(
          `[Indicação] Indicador #${referral.referrerCompanyId} é Fundador. 15 dias enfileirados em override #${queuedOverride.id}.`,
        );
      } else {
        // Indicador normal: estende override ativo se houver, ou cria novo
        const activeOverride = await this.prisma.feeOverride.findFirst({
          where: {
            companyId: referral.referrerCompanyId,
            status: FeeOverrideStatus.ACTIVE,
            endsAt: { gte: now },
          },
          orderBy: { endsAt: 'desc' },
        });

        if (activeOverride) {
          const newEndsAt = new Date(
            activeOverride.endsAt.getTime() + durationMs,
          );
          const updated = await this.prisma.feeOverride.update({
            where: { id: activeOverride.id },
            data: { endsAt: newEndsAt },
          });
          referrerOverrideId = updated.id;
        } else {
          const created = await this.feesService.createOverride({
            companyId: referral.referrerCompanyId,
            barberPixFee: 0.49,
            startsAt: now,
            endsAt: new Date(now.getTime() + durationMs),
            source: FeeOverrideSource.REFERRAL_SENDER,
            sourceId: referral.id,
            status: FeeOverrideStatus.ACTIVE,
          });
          referrerOverrideId = created.id;
        }
      }
    } else {
      this.logger.log(
        `[Indicação] Indicador #${referral.referrerCompanyId} atingiu o teto anual de 90 dias no ciclo.`,
      );
    }

    // 3. Atualiza registro de indicação
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.ACTIVATED,
        activatedAt: now,
        cycleYearStart: cycleStart,
        referredOverrideId: recipientOverride.id,
        referrerOverrideId,
      },
    });

    this.logger.log(
      `[Indicação] Indicação #${referral.id} ativada com sucesso para indicado #${referral.referredCompanyId} e indicador #${referral.referrerCompanyId}.`,
    );
  }

  /**
   * Auditoria manual de Super Admin sobre indicações em REVIEW.
   */
  async reviewReferral(
    referralId: string,
    approve: boolean,
    rejectedReason?: string,
  ): Promise<Referral> {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
    });

    if (!referral) {
      throw new NotFoundException('Indicação não encontrada.');
    }

    if (referral.status !== ReferralStatus.REVIEW) {
      throw new BadRequestException(
        'Esta indicação não está em status de REVIEW.',
      );
    }

    if (approve) {
      await this.activateReferral(referral);
      return this.prisma.referral.findUniqueOrThrow({
        where: { id: referralId },
      });
    } else {
      return this.prisma.referral.update({
        where: { id: referralId },
        data: {
          status: ReferralStatus.REJECTED,
          rejectedReason:
            rejectedReason || 'Rejeitado por auditoria do Super Admin.',
        },
      });
    }
  }

  /**
   * Lista as indicações realizadas pela empresa autenticada.
   */
  async getCompanyReferrals(companyId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerCompanyId: companyId },
      include: {
        referredCompany: {
          select: {
            businessName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });

    const now = new Date();
    const activated = referrals.filter(
      (r) => r.status === ReferralStatus.ACTIVATED,
    );

    let cycleStart = now;
    if (activated.length > 0) {
      const first = activated[0].activatedAt || now;
      const cycleMs = REFERRAL_CYCLE_DAYS * 24 * 60 * 60 * 1000;
      if (now.getTime() - first.getTime() < cycleMs) {
        cycleStart = first;
      }
    }

    const activatedInCycle = activated.filter(
      (r) => r.activatedAt && r.activatedAt >= cycleStart,
    );

    const daysEarnedInCycle = Math.min(
      REFERRAL_MAX_ANNUAL_DAYS,
      activatedInCycle.length * REFERRAL_PROMO_DAYS,
    );

    const activeOverride = await this.prisma.feeOverride.findFirst({
      where: {
        companyId,
        status: FeeOverrideStatus.ACTIVE,
        endsAt: { gte: now },
      },
      orderBy: { endsAt: 'desc' },
    });

    return {
      totalReferrals: referrals.length,
      activatedReferrals: activated.length,
      currentCycle: {
        cycleStart,
        referralsCount: activatedInCycle.length,
        maxReferralsPerYear: REFERRAL_MAX_ANNUAL_DAYS / REFERRAL_PROMO_DAYS,
        daysEarned: daysEarnedInCycle,
        maxDaysPerYear: REFERRAL_MAX_ANNUAL_DAYS,
      },
      activeOverrideEndsAt: activeOverride?.endsAt || null,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredBusinessName: r.referredCompany.businessName,
        status: r.status,
        registeredAt: r.registeredAt,
        activatedAt: r.activatedAt,
        daysGranted:
          r.status === ReferralStatus.ACTIVATED ? REFERRAL_PROMO_DAYS : 0,
      })),
    };
  }

  /**
   * Lista indicações em REVIEW para o Super Admin auditar.
   */
  async listReviewsForAdmin() {
    return this.prisma.referral.findMany({
      where: { status: ReferralStatus.REVIEW },
      include: {
        referrerCompany: {
          select: {
            id: true,
            businessName: true,
            owner: { select: { name: true, email: true, phone: true } },
            financialProfile: {
              select: { cpfCnpj: true, pixAddressKey: true },
            },
          },
        },
        referredCompany: {
          select: {
            id: true,
            businessName: true,
            owner: { select: { name: true, email: true, phone: true } },
            financialProfile: {
              select: { cpfCnpj: true, pixAddressKey: true },
            },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });
  }
}
