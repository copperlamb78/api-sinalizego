import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ApptStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra avaliação para um agendamento concluído (Zero-Trust).
   */
  async create(data: CreateReviewDto, clientId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: {
        review: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    // Regra Zero-Trust: Apenas o próprio cliente que fez o agendamento pode avaliar
    if (appointment.clientId !== clientId) {
      throw new ForbiddenException(
        'Você só pode avaliar agendamentos realizados pela sua própria conta.',
      );
    }

    // Regra: Apenas agendamentos com status COMPLETED podem ser avaliados
    if (appointment.status !== ApptStatus.COMPLETED) {
      throw new BadRequestException(
        'Apenas agendamentos concluídos podem ser avaliados.',
      );
    }

    // Regra: Bloqueio de avaliações duplicadas
    if (appointment.review) {
      throw new ConflictException(
        'Este agendamento já possui uma avaliação registrada.',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        companyId: appointment.companyId,
        appointmentId: appointment.id,
        clientId: clientId,
        employeeId: appointment.employeeId,
        ratingCompany: data.ratingCompany,
        ratingEmployee: data.ratingEmployee ?? null,
        comment: data.comment?.trim() || null,
      },
      include: {
        company: {
          select: { id: true, businessName: true },
        },
        employee: {
          select: { id: true, name: true, roleTitle: true },
        },
      },
    });

    return review;
  }

  /**
   * Consulta pública de avaliações e média geral da empresa.
   */
  async getCompanyReviews(companyId: string, page = 1, limit = 10) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId, isActive: true },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada ou inativa.');
    }

    const skip = (page - 1) * limit;

    const [reviews, total, aggregateData] = await Promise.all([
      this.prisma.review.findMany({
        where: { companyId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ratingCompany: true,
          ratingEmployee: true,
          comment: true,
          createdAt: true,
          client: {
            select: {
              name: true,
            },
          },
          employee: {
            select: {
              id: true,
              name: true,
              roleTitle: true,
            },
          },
        },
      }),
      this.prisma.review.count({ where: { companyId } }),
      this.prisma.review.aggregate({
        where: { companyId },
        _avg: {
          ratingCompany: true,
        },
        _count: {
          ratingCompany: true,
        },
      }),
    ]);

    const averageRating = aggregateData._avg.ratingCompany
      ? Number(aggregateData._avg.ratingCompany.toFixed(1))
      : null;

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        ratingCompany: r.ratingCompany,
        ratingEmployee: r.ratingEmployee,
        comment: r.comment,
        createdAt: r.createdAt,
        clientName: r.client?.name ? r.client.name.split(' ')[0] : 'Cliente',
        employee: r.employee,
      })),
      total,
      averageRating,
      ratingsCount: aggregateData._count.ratingCompany || 0,
      page,
      limit,
    };
  }
}
