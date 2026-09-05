import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CalculateTax } from '../../helpers/calculate-tax.helper';
import { CalculateDeposit } from '../../helpers/calculate-deposit.helper';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';

@Injectable()
export class CompanyServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
    private readonly calculateDeposit: CalculateDeposit,
  ) {}

  async createService(data: CreateServiceDto, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
      include: { financialProfile: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário. Certifique-se de que o usuário possui uma empresa registrada antes de criar um serviço.',
      );
    }

    let financialProfile = company.financialProfile;
    if (!financialProfile) {
      const activeProfile = await this.prisma.financialProfile.findFirst({
        where: { userId: userId, isActive: true },
      });
      if (activeProfile) {
        await this.prisma.company.update({
          where: { id: company.id },
          data: { financialProfileId: activeProfile.id },
        });
        financialProfile = activeProfile;
      }
    }

    // Trava de Onboarding: o barbeiro deve ter configurado a conta financeira/bancária (Asaas) antes de cadastrar serviços
    if (!financialProfile || !financialProfile.walletId) {
      throw new BadRequestException(
        'Para cadastrar serviços, você precisa primeiro configurar sua conta bancária/financeira no painel.',
      );
    }

    const serviceGroup = await this.prisma.serviceGroup.findFirst({
      where: { id: data.serviceGroupId, companyId: company.id },
    });

    if (!serviceGroup) {
      throw new NotFoundException(
        'Grupo de serviços não encontrado ou não pertence a esta empresa.',
      );
    }

    // Normalização da regra de sinal:
    // - Se price < 400: força 50%
    // - Se price >= 400: aceita 30% ou 50% (default 50)
    const price = Number(data.totalPrice);
    const rawPercent = data.depositPercentage ?? data.downPaymentPercent ?? 50;
    let downPaymentPercent = 50;
    if (price >= 400 && rawPercent === 30) {
      downPaymentPercent = 30;
    }

    const service = await this.prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        totalPrice: data.totalPrice,
        downPaymentPercent: downPaymentPercent,
        serviceGroupId: data.serviceGroupId,
        companyId: company.id,
      },
    });

    return service;
  }

  // rota da vitrine
  async getServicesBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: slug },
    });

    if (!company) {
      throw new NotFoundException('Nenhuma empresa encontrada para este slug.');
    }

    const services = await this.prisma.service.findMany({
      where: { companyId: company.id, isActive: true },
    });

    if (services.length === 0) {
      throw new NotFoundException(
        'Nenhum serviço encontrado para esta empresa.',
      );
    }

    return services.map((service) => {
      const price = Number(service.totalPrice);
      const deposit = this.calculateDeposit.calculateDeposit(
        price,
        service.downPaymentPercent,
      );
      return {
        ...service,
        totalPrice: price,
        downPaymentAmount: deposit,
        platformTax: this.calculateTax.calculatePlatformTax(deposit),
      };
    });
  }

  async getServicesByCompany(userId: string, filters?: FilterServiceDto) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    const whereClause: any = { companyId: company.id };
    let orderByClause: any = { createdAt: 'desc' };

    if (filters) {
      if (filters.status === 'active') whereClause.isActive = true;
      if (filters.status === 'inactive') whereClause.isActive = false;

      if (filters.totalPrice) whereClause.totalPrice = filters.totalPrice;
      if (filters.durationMinutes)
        whereClause.durationMinutes = filters.durationMinutes;
      if (filters.serviceGroupId)
        whereClause.serviceGroupId = filters.serviceGroupId;
      if (filters.downPaymentPercent)
        whereClause.downPaymentPercent = filters.downPaymentPercent;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const services = await this.prisma.service.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    return services;
  }

  async updateService(
    userId: string,
    serviceId: string,
    data: UpdateServiceDto,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    const serviceExists = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId: company.id },
    });

    if (!serviceExists) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    if (data.serviceGroupId) {
      const serviceGroup = await this.prisma.serviceGroup.findFirst({
        where: { id: data.serviceGroupId, companyId: company.id },
      });

      if (!serviceGroup) {
        throw new NotFoundException(
          'Grupo de serviços não encontrado ou não pertence a esta empresa.',
        );
      }
    }

    const updateData: any = { ...data };
    delete updateData.depositPercentage;

    const priceToCheck =
      data.totalPrice !== undefined
        ? Number(data.totalPrice)
        : Number(serviceExists.totalPrice);

    const rawPercent =
      data.depositPercentage !== undefined
        ? data.depositPercentage
        : data.downPaymentPercent;

    if (priceToCheck < 400) {
      updateData.downPaymentPercent = 50;
    } else if (rawPercent !== undefined) {
      updateData.downPaymentPercent = rawPercent === 30 ? 30 : 50;
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: updateData,
    });
  }

  async deactivateService(userId: string, serviceId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    const serviceExists = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId: company.id },
    });

    if (!serviceExists) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false, disabledAt: new Date() },
    });
  }

  async activateService(userId: string, serviceId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário.',
      );
    }

    const serviceExists = await this.prisma.service.findFirst({
      where: { id: serviceId, companyId: company.id },
    });

    if (!serviceExists) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: true, disabledAt: null },
    });
  }

  async getAllServices(filters?: FilterServiceDto) {
    const whereClause: any = {};
    let orderByClause: any = { createdAt: 'desc' };

    if (filters) {
      if (filters.status === 'active') whereClause.isActive = true;
      if (filters.status === 'inactive') whereClause.isActive = false;

      if (filters.totalPrice) whereClause.totalPrice = filters.totalPrice;
      if (filters.durationMinutes)
        whereClause.durationMinutes = filters.durationMinutes;
      if (filters.serviceGroupId)
        whereClause.serviceGroupId = filters.serviceGroupId;
      if (filters.downPaymentPercent)
        whereClause.downPaymentPercent = filters.downPaymentPercent;
      if (filters.orderBy) {
        orderByClause = { createdAt: filters.orderBy };
      }
    }

    const services = await this.prisma.service.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    return services;
  }
}
