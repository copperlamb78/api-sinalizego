import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateServiceGroupDto } from './dto/create-service-group.dto';
import { UpdateServiceGroupDto } from './dto/update-service-group.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FiltersServiceGroupDto } from './dto/filters-service-group.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ServiceGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateServiceGroupDto, userId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: data.companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (!isSystemManager && company.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para criar grupos de serviços nesta empresa.',
      );
    }

    return await this.prisma.serviceGroup.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        companyId: data.companyId,
      },
    });
  }

  async findAll(filters?: FiltersServiceGroupDto) {
    const whereClause: any = { isActive: true };

    if (filters) {
      if (filters.name) whereClause.name = filters.name;
      if (filters.capacity) whereClause.capacity = filters.capacity;
      if (filters.companyId) whereClause.companyId = filters.companyId;
    }

    return await this.prisma.serviceGroup.findMany({
      where: whereClause,
    });
  }

  async findOneById(id: string) {
    const serviceGroup = await this.prisma.serviceGroup.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!serviceGroup) {
      throw new NotFoundException('Grupo de serviços não encontrado.');
    }

    return serviceGroup;
  }

  async findAllByCompanyId(
    companyId: string,
    userId: string,
    filters?: FiltersServiceGroupDto,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (!isSystemManager && company.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os grupos de serviços desta empresa.',
      );
    }

    const whereClause: any = { companyId, isActive: true };

    if (filters) {
      if (filters.name) whereClause.name = filters.name;
      if (filters.capacity) whereClause.capacity = filters.capacity;
    }

    return await this.prisma.serviceGroup.findMany({
      where: whereClause,
    });
  }

  async updateByCompanyId(
    id: string,
    companyId: string,
    userId: string,
    data: UpdateServiceGroupDto,
  ) {
    const serviceGroup = await this.prisma.serviceGroup.findFirst({
      where: { id, companyId },
      include: {
        company: true,
      },
    });

    if (!serviceGroup) {
      throw new NotFoundException(
        'Grupo de serviços não encontrado para esta empresa.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (!isSystemManager && serviceGroup.company?.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este grupo de serviços.',
      );
    }

    return await this.prisma.serviceGroup.update({
      where: { id },
      data,
    });
  }

  async update(id: string, userId: string, data: UpdateServiceGroupDto) {
    const serviceGroup = await this.prisma.serviceGroup.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!serviceGroup) {
      throw new NotFoundException('Grupo de serviços não encontrado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (!isSystemManager && serviceGroup.company?.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este grupo de serviços.',
      );
    }

    return await this.prisma.serviceGroup.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string) {
    const serviceGroup = await this.prisma.serviceGroup.findUnique({
      where: { id },
      include: {
        company: true,
        services: {
          where: { isActive: true },
        },
      },
    });

    if (!serviceGroup) {
      throw new NotFoundException('Grupo de serviços não encontrado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (!isSystemManager && serviceGroup.company?.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para remover este grupo de serviços.',
      );
    }

    if (serviceGroup.services && serviceGroup.services.length > 0) {
      throw new BadRequestException(
        'Não é possível remover um grupo de serviços que ainda possui serviços ativos vinculados. Desative ou transfira os serviços primeiro.',
      );
    }

    return await this.prisma.serviceGroup.update({
      where: { id },
      data: {
        isActive: false,
        disabledAt: new Date(),
      },
    });
  }
}
