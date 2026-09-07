import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditStatus, Role } from '@prisma/client';

@Injectable()
export class ClientCreditsService {
  private readonly logger = new Logger(ClientCreditsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna todos os créditos do cliente autenticado (disponíveis, utilizados e expirados)
   * atualizando automaticamente créditos com data expirada.
   */
  async getMyCredits(userId: string) {
    const now = new Date();

    // Atualiza automaticamente créditos vencidos que ainda constam como AVAILABLE
    await this.prisma.clientCredit.updateMany({
      where: {
        clientId: userId,
        status: CreditStatus.AVAILABLE,
        expiresAt: { lt: now },
      },
      data: { status: CreditStatus.EXPIRED },
    });

    const credits = await this.prisma.clientCredit.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            businessName: true,
            slug: true,
            logoPhoto: true,
            district: true,
            city: true,
          },
        },
      },
    });

    const availableCredits = credits.filter(
      (c) => c.status === CreditStatus.AVAILABLE && new Date(c.expiresAt) > now,
    );

    const totalAvailable = availableCredits.reduce(
      (acc, c) => acc + Number(c.amount),
      0,
    );

    // Agrupa por empresa para facilitar a visualização no card de créditos
    const byCompanyMap = new Map<
      string,
      {
        companyId: string;
        businessName: string;
        slug: string;
        logoPhoto: string | null;
        totalAmount: number;
        items: typeof credits;
      }
    >();

    for (const item of availableCredits) {
      const cId = item.companyId;
      const existing = byCompanyMap.get(cId);
      const itemAmount = Number(item.amount);

      if (!existing) {
        byCompanyMap.set(cId, {
          companyId: cId,
          businessName: item.company.businessName,
          slug: item.company.slug,
          logoPhoto: item.company.logoPhoto,
          totalAmount: itemAmount,
          items: [item],
        });
      } else {
        existing.totalAmount += itemAmount;
        existing.items.push(item);
      }
    }

    return {
      totalAvailable: Number(totalAvailable.toFixed(2)),
      availableByCompany: Array.from(byCompanyMap.values()),
      allCredits: credits.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        status: c.status,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        usedAt: c.usedAt,
        company: c.company,
      })),
    };
  }

  /**
   * Retorna o saldo disponível de créditos do cliente em uma empresa específica.
   * Utilizado pelo Checkout e pela Vitrine da barbearia.
   */
  async getCompanyCreditBalance(userId: string, companyId: string) {
    const now = new Date();

    await this.prisma.clientCredit.updateMany({
      where: {
        clientId: userId,
        companyId,
        status: CreditStatus.AVAILABLE,
        expiresAt: { lt: now },
      },
      data: { status: CreditStatus.EXPIRED },
    });

    const credits = await this.prisma.clientCredit.findMany({
      where: {
        clientId: userId,
        companyId,
        status: CreditStatus.AVAILABLE,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'asc' },
    });

    const total = credits.reduce((acc, c) => acc + Number(c.amount), 0);

    return {
      companyId,
      availableAmount: Number(total.toFixed(2)),
      creditsCount: credits.length,
      credits: credits.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        expiresAt: c.expiresAt,
      })),
    };
  }

  /**
   * Retorna para o dono da barbearia todos os créditos ativos e históricos emitidos pela empresa.
   */
  async getCompanyCreditsForOwner(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, userId },
      select: { id: true },
    });

    if (!company) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os créditos desta empresa.',
      );
    }

    const credits = await this.prisma.clientCredit.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const totalActive = credits
      .filter(
        (c) =>
          c.status === CreditStatus.AVAILABLE &&
          new Date(c.expiresAt) > new Date(),
      )
      .reduce((acc, c) => acc + Number(c.amount), 0);

    return {
      companyId,
      totalActiveInCustody: Number(totalActive.toFixed(2)),
      credits: credits.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        status: c.status,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        usedAt: c.usedAt,
        client: c.client,
      })),
    };
  }
}
