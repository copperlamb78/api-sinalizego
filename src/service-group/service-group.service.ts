import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceGroupDto } from './dto/create-service-group.dto';
import { UpdateServiceGroupDto } from './dto/update-service-group.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FiltersServiceGroupDto } from './dto/filters-service-group.dto';

@Injectable()
export class ServiceGroupService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateServiceGroupDto) {
    const existingCompany = this.prisma.company.findUnique({
      where: { id: data.companyId },
    });
    if (!existingCompany) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const serviceGroup = this.prisma.serviceGroup.create({
      data: {
        name: data.name,
        capacity: data.capacity,
        companyId: data.companyId,
      },
    });
    return serviceGroup;
  }

  findAll(filters?: FiltersServiceGroupDto) {
    const whereClause: any = {};

    if (filters) {
      if (filters.name) whereClause.name = filters.name;
      if (filters.capacity) whereClause.capacity = filters.capacity;
      if (filters.companyId) whereClause.companyId = filters.companyId;
    }

    const serviceGroups = this.prisma.serviceGroup.findMany({
      where: whereClause,
    });
    return serviceGroups;
  }

  findOneById(id: string) {
    const serviceGroup = this.prisma.serviceGroup.findUnique({
      where: { id: id },
    });
    return serviceGroup;
  }

  findAllByCompanyId(companyId: string, filters?: FiltersServiceGroupDto) {
    const whereClause: any = { companyId: companyId };

    if (filters) {
      if (filters.name) whereClause.name = filters.name;
      if (filters.capacity) whereClause.capacity = filters.capacity;
    }

    const serviceGroups = this.prisma.serviceGroup.findMany({
      where: whereClause,
    });
    return serviceGroups;
  }

  updateByCompanyId(
    id: string,
    companyId: string,
    data: UpdateServiceGroupDto,
  ) {
    const serviceGroupExisits = this.prisma.serviceGroup.findFirst({
      where: { id: id, companyId: companyId },
    });

    if (!serviceGroupExisits) {
      throw new NotFoundException(
        'Grupo de serviços não encontrado para esta empresa.',
      );
    }

    const updatedServiceGroup = this.prisma.serviceGroup.update({
      where: { id: id },
      data: data,
    });
    return updatedServiceGroup;
  }

  update(id: string, data: UpdateServiceGroupDto) {
    const serviceGroupExists = this.prisma.serviceGroup.findUnique({
      where: { id: id },
    });

    if (!serviceGroupExists) {
      throw new NotFoundException('Grupo de serviços não encontrado.');
    }

    const updatedServiceGroup = this.prisma.serviceGroup.update({
      where: { id: id },
      data: data,
    });

    return updatedServiceGroup;
  }

  remove(id: string) {
    const serviceGroupExists = this.prisma.serviceGroup.findUnique({
      where: { id: id },
    });

    if (!serviceGroupExists) {
      throw new NotFoundException('Grupo de serviços não encontrado.');
    }

    const deletedServiceGroup = this.prisma.serviceGroup.delete({
      where: { id: id },
    });
    return deletedServiceGroup;
  }
}
