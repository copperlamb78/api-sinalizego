import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CalculateTax } from './helpers/calculate-tax.helper';

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
      where: { providerId: provider.id },
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

  async getServicesByProvider(userId: string) {
    const provider = await this.prisma.provider.findFirst({
      where: { userId: userId },
    });

    if (!provider) {
      throw new NotFoundException(
        'Nenhum negócio encontrado para este usuário.',
      );
    }

    const services = await this.prisma.service.findMany({
      where: { providerId: provider.id },
    });

    return services;
  }
}
