import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CalculateTax } from '../../helpers/calculate-tax.helper';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FilterServiceDto } from './dto/filter-service.dto';

@Injectable()
export class ProvidersServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculateTax: CalculateTax,
  ) {}

  async createService(data: CreateServiceDto, userId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário. Certifique-se de que o usuário possui um negócio registrado antes de criar um serviço.',
      );
    }

    const service = await this.prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        totalPrice: data.totalPrice,
        downPaymentPercent: data.downPaymentPercent,
        availableEmployers: data.availableEmployers,
        providerId: provider.id,
      },
    });

    return service;
  }
  // rota da vitrine
  async getServicesBySlug(slug: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { slug: slug },
    });

    if (!provider) {
      throw new NotFoundException('Nenhum negócio encontrado para este slug.');
    }

    const services = await this.prisma.service.findMany({
      where: { providerId: provider.id, isActive: true },
    });

    if (services.length === 0) {
      throw new NotFoundException(
        'Nenhum serviço encontrado para este negócio.',
      );
    }

    return services.map((service) => ({
      ...service,
      platformTax: this.calculateTax.calculatePlatformTax(service.totalPrice),
    }));
  }

  async getServicesByProvider(userId: string, filters?: FilterServiceDto) {
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário.',
      );
    }

    const whereClause: any = { providerId: provider.id };
    let orderByClause: any = { createdAt: 'desc' };

    if (filters) {
      if (filters.status === 'active') whereClause.isActive = true;
      if (filters.status === 'inactive') whereClause.isActive = false;

      if (filters.totalPrice) whereClause.totalPrice = filters.totalPrice;
      if (filters.durationMinutes)
        whereClause.durationMinutes = filters.durationMinutes;
      if (filters.availableEmployers)
        whereClause.availableEmployers = filters.availableEmployers;
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
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário.',
      );
    }

    const serviceExists = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId: provider.id },
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
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário.',
      );
    }

    const serviceExists = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId: provider.id },
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
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário.',
      );
    }

    const serviceExists = await this.prisma.service.findFirst({
      where: { id: serviceId, providerId: provider.id },
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
      if (filters.availableEmployers)
        whereClause.availableEmployers = filters.availableEmployers;
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
