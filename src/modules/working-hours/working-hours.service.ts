import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import { WorkingHourItemDto } from './dto/working-hour-item.dto';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { Role } from '@prisma/client';

@Injectable()
export class WorkingHoursService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida coerência de horários de abertura, fechamento e intervalo de almoço.
   */
  private validateTimeIntervals(item: WorkingHourItemDto) {
    if (item.isClosed) {
      return;
    }

    if (!item.startTime || !item.endTime) {
      throw new BadRequestException(
        `Dia ${item.dayOfWeek}: Horários de abertura (startTime) e fechamento (endTime) são obrigatórios quando o estabelecimento está aberto.`,
      );
    }

    if (item.startTime >= item.endTime) {
      throw new BadRequestException(
        `Dia ${item.dayOfWeek}: Horário de abertura (${item.startTime}) deve ser anterior ao horário de fechamento (${item.endTime}).`,
      );
    }

    const hasLunchStart = !!item.lunchStartTime;
    const hasLunchEnd = !!item.lunchEndTime;

    if (hasLunchStart !== hasLunchEnd) {
      throw new BadRequestException(
        `Dia ${item.dayOfWeek}: Ambos os horários de início e fim de almoço devem ser informados juntos.`,
      );
    }

    if (hasLunchStart && hasLunchEnd) {
      const lunchStart = item.lunchStartTime!;
      const lunchEnd = item.lunchEndTime!;

      if (lunchStart >= lunchEnd) {
        throw new BadRequestException(
          `Dia ${item.dayOfWeek}: Início do almoço (${lunchStart}) deve ser anterior ao fim do almoço (${lunchEnd}).`,
        );
      }

      if (lunchStart < item.startTime || lunchEnd > item.endTime) {
        throw new BadRequestException(
          `Dia ${item.dayOfWeek}: Intervalo de almoço (${lunchStart} - ${lunchEnd}) deve estar contido dentro do expediente (${item.startTime} - ${item.endTime}).`,
        );
      }
    }
  }

  /**
   * Resolve e valida a empresa pertencente ao usuário autenticado (Anti-IDOR).
   */
  private async resolveCompany(userId: string, companyId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new NotFoundException('Empresa não encontrada.');
      }

      if (!isSystemManager && company.userId !== userId) {
        throw new ForbiddenException(
          'Você não tem permissão para gerenciar os horários desta empresa.',
        );
      }

      return company;
    }

    const userCompany = await this.prisma.company.findFirst({
      where: { userId: userId, isActive: true },
    });

    if (!userCompany) {
      throw new NotFoundException(
        'Nenhuma empresa ativa vinculada ao seu usuário.',
      );
    }

    return userCompany;
  }

  /**
   * Atualiza ou cadastra os horários de funcionamento semanais da empresa.
   */
  async updateWorkingHours(userId: string, dto: UpdateWorkingHoursDto) {
    const company = await this.resolveCompany(userId, dto.companyId);

    // Valida todos os itens antes de persistir
    for (const item of dto.hours) {
      this.validateTimeIntervals(item);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.hours) {
        const isClosed = item.isClosed ?? false;
        const startTime = isClosed ? '00:00' : item.startTime!;
        const endTime = isClosed ? '00:00' : item.endTime!;
        const lunchStartTime = isClosed ? null : (item.lunchStartTime ?? null);
        const lunchEndTime = isClosed ? null : (item.lunchEndTime ?? null);

        await tx.workingHour.upsert({
          where: {
            companyId_dayOfWeek: {
              companyId: company.id,
              dayOfWeek: item.dayOfWeek,
            },
          },
          update: {
            startTime,
            endTime,
            lunchStartTime,
            lunchEndTime,
            isClosed,
          },
          create: {
            companyId: company.id,
            dayOfWeek: item.dayOfWeek,
            startTime,
            endTime,
            lunchStartTime,
            lunchEndTime,
            isClosed,
          },
        });
      }
    });

    return this.prisma.workingHour.findMany({
      where: { companyId: company.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * Lista a grade semanal de funcionamento da empresa autenticada.
   */
  async getWorkingHours(userId: string, companyId?: string) {
    const company = await this.resolveCompany(userId, companyId);

    return this.prisma.workingHour.findMany({
      where: { companyId: company.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * Consulta pública da grade semanal de horários de uma empresa pelo ID.
   */
  async getWorkingHoursByCompanyId(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId, isActive: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada ou inativa.');
    }

    return this.prisma.workingHour.findMany({
      where: { companyId: company.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * Cadastra uma nova exceção na agenda (feriado, folga ou horário especial).
   */
  async createScheduleException(
    userId: string,
    dto: CreateScheduleExceptionDto,
  ) {
    const company = await this.resolveCompany(userId, dto.companyId);

    const isClosed = dto.isClosed ?? true;

    if (!isClosed) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'Horários de início e fim são obrigatórios para exceções com atendimento aberto.',
        );
      }
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException(
          `Horário de abertura (${dto.startTime}) deve ser anterior ao de encerramento (${dto.endTime}).`,
        );
      }
    }

    const [year, month, day] = dto.date.split('-').map(Number);
    const exceptionDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (isNaN(exceptionDate.getTime())) {
      throw new BadRequestException('Formato de data inválido.');
    }

    return this.prisma.scheduleException.create({
      data: {
        companyId: company.id,
        date: exceptionDate,
        isClosed: isClosed,
        startTime: isClosed ? null : (dto.startTime ?? null),
        endTime: isClosed ? null : (dto.endTime ?? null),
        description: dto.description ?? null,
      },
    });
  }

  /**
   * Lista exceções ativas da empresa autenticada.
   */
  async getScheduleExceptions(userId: string, companyId?: string) {
    const company = await this.resolveCompany(userId, companyId);

    const now = new Date();
    const startOfTodayUTC = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    return this.prisma.scheduleException.findMany({
      where: {
        companyId: company.id,
        isActive: true,
        date: { gte: startOfTodayUTC },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Remove/desativa uma exceção de agenda com proteção Anti-IDOR.
   */
  async deleteScheduleException(exceptionId: string, userId: string) {
    const exception = await this.prisma.scheduleException.findUnique({
      where: { id: exceptionId },
      include: { company: true },
    });

    if (!exception) {
      throw new NotFoundException('Exceção de agenda não encontrada.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const isSystemManager =
      user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

    if (!isSystemManager && exception.company?.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para remover esta exceção.',
      );
    }

    return this.prisma.scheduleException.update({
      where: { id: exceptionId },
      data: {
        isActive: false,
        disabledAt: new Date(),
      },
    });
  }
}
