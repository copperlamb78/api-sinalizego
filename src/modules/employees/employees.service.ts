import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  EmployeeStatusFilter,
  FiltersEmployeeDto,
} from './dto/filters-employee.dto';
import { ApptStatus, Prisma } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a empresa do usuário autenticado (Anti-IDOR).
   */
  async resolveCompanyForUser(userId: string) {
    const company = await this.prisma.company.findFirst({
      where: { userId, isActive: true },
      select: { id: true, businessName: true, timezone: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Nenhuma empresa ativa encontrada para este usuário.',
      );
    }

    return company;
  }

  /**
   * Cadastro de funcionário com vínculos consistentes e seguros.
   */
  async create(data: CreateEmployeeDto, userId: string) {
    const company = await this.resolveCompanyForUser(userId);

    // Valida grupos se fornecidos
    if (data.groupIds && data.groupIds.length > 0) {
      const groups = await this.prisma.serviceGroup.findMany({
        where: {
          id: { in: data.groupIds },
          companyId: company.id,
          isActive: true,
        },
        select: { id: true },
      });

      if (groups.length !== data.groupIds.length) {
        throw new BadRequestException(
          'Um ou mais grupos de serviços informados não existem ou não pertencem à sua empresa.',
        );
      }
    }

    // Valida serviços se fornecidos
    if (data.serviceIds && data.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: {
          id: { in: data.serviceIds },
          companyId: company.id,
          isActive: true,
        },
        select: { id: true },
      });

      if (services.length !== data.serviceIds.length) {
        throw new BadRequestException(
          'Um ou mais serviços informados não existem ou não pertencem à sua empresa.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId: company.id,
          name: data.name.trim(),
          email: data.email?.trim().toLowerCase() || null,
          phone: data.phone?.trim() || null,
          photoUrl: data.photoUrl?.trim() || null,
          roleTitle: data.roleTitle?.trim() || null,
          isActive: true,
          groups: data.groupIds && data.groupIds.length > 0
            ? {
                create: data.groupIds.map((groupId) => ({
                  serviceGroupId: groupId,
                })),
              }
            : undefined,
          services: data.serviceIds && data.serviceIds.length > 0
            ? {
                create: data.serviceIds.map((serviceId) => ({
                  serviceId: serviceId,
                })),
              }
            : undefined,
        },
        include: {
          groups: {
            include: {
              serviceGroup: {
                select: { id: true, name: true, capacity: true },
              },
            },
          },
          services: {
            include: {
              service: {
                select: { id: true, name: true, durationMinutes: true, totalPrice: true },
              },
            },
          },
        },
      });

      return employee;
    });
  }

  /**
   * Listagem de funcionários com paginação e filtros de status, grupo e busca textual.
   */
  async findAll(userId: string, filters?: FiltersEmployeeDto) {
    const company = await this.resolveCompanyForUser(userId);

    const where: Prisma.EmployeeWhereInput = {
      companyId: company.id,
    };

    if (filters?.status === EmployeeStatusFilter.ACTIVE) {
      where.isActive = true;
    } else if (filters?.status === EmployeeStatusFilter.INACTIVE) {
      where.isActive = false;
    }

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { roleTitle: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (filters?.groupId) {
      where.groups = {
        some: {
          serviceGroupId: filters.groupId,
        },
      };
    }

    if (filters?.serviceId) {
      where.services = {
        some: {
          serviceId: filters.serviceId,
        },
      };
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: {
          groups: {
            include: {
              serviceGroup: {
                select: { id: true, name: true, capacity: true },
              },
            },
          },
          services: {
            include: {
              service: {
                select: { id: true, name: true, durationMinutes: true, totalPrice: true },
              },
            },
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Consulta detalhada de um funcionário com proteção contra IDOR.
   */
  async findOne(id: string, userId: string) {
    const company = await this.resolveCompanyForUser(userId);

    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        companyId: company.id,
      },
      include: {
        groups: {
          include: {
            serviceGroup: {
              select: { id: true, name: true, capacity: true },
            },
          },
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true, durationMinutes: true, totalPrice: true },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Funcionário não encontrado ou não pertence à sua empresa.');
    }

    return employee;
  }

  /**
   * Agregação estatística real com cálculos delegados ao PostgreSQL.
   */
  async getStats(id: string, userId: string) {
    const employee = await this.findOne(id, userId);

    const now = new Date();
    // Início e fim do dia UTC
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    // Início e fim do mês UTC
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    const [completedToday, completedMonth, completedTotal, reviewAggregation] =
      await Promise.all([
        this.prisma.appointment.count({
          where: {
            employeeId: employee.id,
            status: ApptStatus.COMPLETED,
            appointmentDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        }),
        this.prisma.appointment.count({
          where: {
            employeeId: employee.id,
            status: ApptStatus.COMPLETED,
            appointmentDate: {
              gte: startOfMonth,
              lt: nextMonth,
            },
          },
        }),
        this.prisma.appointment.count({
          where: {
            employeeId: employee.id,
            status: ApptStatus.COMPLETED,
          },
        }),
        this.prisma.review.aggregate({
          where: {
            employeeId: employee.id,
            ratingEmployee: { not: null },
          },
          _avg: {
            ratingEmployee: true,
          },
          _count: {
            ratingEmployee: true,
          },
        }),
      ]);

    const averageRating = reviewAggregation._avg.ratingEmployee
      ? Number(reviewAggregation._avg.ratingEmployee.toFixed(1))
      : null;
    const ratingsCount = reviewAggregation._count.ratingEmployee || 0;

    return {
      employeeId: employee.id,
      completedToday,
      completedMonth,
      completedTotal,
      averageRating,
      ratingsCount,
    };
  }

  /**
   * Atualização transacional de dados cadastrais e vínculos M:N.
   */
  async update(id: string, data: UpdateEmployeeDto, userId: string) {
    const employee = await this.findOne(id, userId);

    if (data.groupIds && data.groupIds.length > 0) {
      const groups = await this.prisma.serviceGroup.findMany({
        where: {
          id: { in: data.groupIds },
          companyId: employee.companyId,
          isActive: true,
        },
        select: { id: true },
      });

      if (groups.length !== data.groupIds.length) {
        throw new BadRequestException(
          'Um ou mais grupos de serviços informados não existem ou não pertencem à sua empresa.',
        );
      }
    }

    if (data.serviceIds && data.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: {
          id: { in: data.serviceIds },
          companyId: employee.companyId,
          isActive: true,
        },
        select: { id: true },
      });

      if (services.length !== data.serviceIds.length) {
        throw new BadRequestException(
          'Um ou mais serviços informados não existem ou não pertencem à sua empresa.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Atualiza vínculos de grupos se enviados
      if (data.groupIds !== undefined) {
        await tx.employeeGroup.deleteMany({
          where: { employeeId: employee.id },
        });

        if (data.groupIds.length > 0) {
          await tx.employeeGroup.createMany({
            data: data.groupIds.map((serviceGroupId) => ({
              employeeId: employee.id,
              serviceGroupId,
            })),
          });
        }
      }

      // Atualiza vínculos de serviços se enviados
      if (data.serviceIds !== undefined) {
        await tx.employeeService.deleteMany({
          where: { employeeId: employee.id },
        });

        if (data.serviceIds.length > 0) {
          await tx.employeeService.createMany({
            data: data.serviceIds.map((serviceId) => ({
              employeeId: employee.id,
              serviceId,
            })),
          });
        }
      }

      const updated = await tx.employee.update({
        where: { id: employee.id },
        data: {
          name: data.name !== undefined ? data.name.trim() : undefined,
          email: data.email !== undefined ? (data.email?.trim().toLowerCase() || null) : undefined,
          phone: data.phone !== undefined ? (data.phone?.trim() || null) : undefined,
          photoUrl: data.photoUrl !== undefined ? (data.photoUrl?.trim() || null) : undefined,
          roleTitle: data.roleTitle !== undefined ? (data.roleTitle?.trim() || null) : undefined,
          isActive: data.isActive !== undefined ? data.isActive : undefined,
          disabledAt: data.isActive === false ? new Date() : (data.isActive === true ? null : undefined),
        },
        include: {
          groups: {
            include: {
              serviceGroup: {
                select: { id: true, name: true, capacity: true },
              },
            },
          },
          services: {
            include: {
              service: {
                select: { id: true, name: true, durationMinutes: true, totalPrice: true },
              },
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Ativação e desativação sem exclusão do histórico.
   */
  async toggleStatus(id: string, userId: string) {
    const employee = await this.findOne(id, userId);

    const newStatus = !employee.isActive;

    return this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        isActive: newStatus,
        disabledAt: newStatus ? null : new Date(),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        disabledAt: true,
      },
    });
  }

  /**
   * Endpoint público para listar profissionais habilitados para um serviço na vitrine pública.
   */
  async getPublicEmployeesByService(companyId: string, serviceId: string) {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        services: {
          some: {
            serviceId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        roleTitle: true,
        photoUrl: true,
      },
      orderBy: { name: 'asc' },
    });

    return employees;
  }
}
