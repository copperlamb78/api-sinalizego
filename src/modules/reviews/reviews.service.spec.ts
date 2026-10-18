import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApptStatus } from '@prisma/client';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockAppointment = {
    id: 'appt-uuid-1',
    companyId: 'company-uuid-1',
    clientId: 'client-uuid-1',
    employeeId: 'employee-uuid-1',
    status: ApptStatus.COMPLETED,
    review: null,
  };

  const mockReview = {
    id: 'review-uuid-1',
    companyId: 'company-uuid-1',
    appointmentId: 'appt-uuid-1',
    clientId: 'client-uuid-1',
    employeeId: 'employee-uuid-1',
    ratingCompany: 5,
    ratingEmployee: 5,
    comment: 'Excelente corte!',
    createdAt: new Date(),
    updatedAt: new Date(),
    company: { id: 'company-uuid-1', businessName: 'Barbearia Modelo' },
    employee: { id: 'employee-uuid-1', name: 'Carlos', roleTitle: 'Barbeiro' },
  };

  const mockPrisma = {
    appointment: {
      findUnique: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve registrar avaliação com sucesso para agendamento concluído', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(mockAppointment);
      mockPrisma.review.create.mockResolvedValue(mockReview);

      const result = await service.create(
        {
          appointmentId: 'appt-uuid-1',
          ratingCompany: 5,
          ratingEmployee: 5,
          comment: 'Excelente corte!',
        },
        'client-uuid-1',
      );

      expect(result).toEqual(mockReview);
      expect(mockPrisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-uuid-1',
            employeeId: 'employee-uuid-1',
            ratingCompany: 5,
            ratingEmployee: 5,
          }),
        }),
      );
    });

    it('deve lançar ForbiddenException se outro usuário tentar avaliar (Zero-Trust Anti-IDOR)', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(mockAppointment);

      await expect(
        service.create(
          {
            appointmentId: 'appt-uuid-1',
            ratingCompany: 5,
          },
          'other-client-uuid',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar BadRequestException se o agendamento não estiver com status COMPLETED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        status: ApptStatus.CONFIRMED,
      });

      await expect(
        service.create(
          {
            appointmentId: 'appt-uuid-1',
            ratingCompany: 5,
          },
          'client-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar ConflictException se o agendamento já tiver sido avaliado', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...mockAppointment,
        review: { id: 'existing-review' },
      });

      await expect(
        service.create(
          {
            appointmentId: 'appt-uuid-1',
            ratingCompany: 5,
          },
          'client-uuid-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getCompanyReviews', () => {
    it('deve retornar lista pública de avaliações e média agregada', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-uuid-1' });
      mockPrisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          ratingCompany: 5,
          ratingEmployee: 4,
          comment: 'Muito bom!',
          createdAt: new Date(),
          client: { name: 'João Silva' },
          employee: { id: 'emp-1', name: 'Carlos', roleTitle: 'Barbeiro' },
        },
      ]);
      mockPrisma.review.count.mockResolvedValue(1);
      mockPrisma.review.aggregate.mockResolvedValue({
        _avg: { ratingCompany: 4.9 },
        _count: { ratingCompany: 1 },
      });

      const result = await service.getCompanyReviews('company-uuid-1', 1, 10);

      expect(result.total).toBe(1);
      expect(result.averageRating).toBe(4.9);
      expect(result.reviews[0].clientName).toBe('João');
    });
  });
});
