import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CalculateTax } from '../../helpers/calculate-tax.helper';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';

@Injectable()
export class CompanyServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
  ) {}

  async createService(data: CreateServiceDto, userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId: userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa encontrada para este usuário. Certifique-se de que o usuário possui uma empresa registrada antes de criar um serviço.',
      );
    }

    const service = await this.prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        totalPrice: data.totalPrice,
        downPaymentPercent: data.downPaymentPercent,
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

    return services.map((service) => ({
      ...service,
      platformTax: this.calculateTax.calculatePlatformTax(service.totalPrice),
    }));
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

    return this.prisma.service.update({
      where: { id: serviceId },
      data: data,
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
