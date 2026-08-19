import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApptStatus, Role } from '@prisma/client';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  const mockPrisma = {
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    companyService: {
      findFirst: jest.fn(),
    },
  };

  const mockCalculateTax = {
    calculateTotal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CalculateTax,
          useValue: mockCalculateTax,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateAppointmentStatus', () => {
    const appointmentMock = {
      id: 'appointment-1',
      clientId: 'client-1',
      status: ApptStatus.CONFIRMED,
      company: {
        id: 'company-1',
        userId: 'owner-1',
      },
    };

    const ownerUserMock = {
      id: 'owner-1',
      role: Role.COMPANY_OWNER,
    };

    const otherUserMock = {
      id: 'other-user',
      role: Role.COMPANY_OWNER,
    };

    it('should throw BadRequestException if trying to transition to CONFIRMED manually', async () => {
      await expect(
        service.updateAppointmentStatus('appointment-1', 'owner-1', {
          status: ApptStatus.CONFIRMED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to transition to PENDING_PAYMENT manually', async () => {
      await expect(
        service.updateAppointmentStatus('appointment-1', 'owner-1', {
          status: ApptStatus.PENDING_PAYMENT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if appointment does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAppointmentStatus('non-existent', 'owner-1', {
          status: ApptStatus.COMPLETED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the company and is not admin', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(appointmentMock);
      mockPrisma.user.findUnique.mockResolvedValue(otherUserMock);

      await expect(
        service.updateAppointmentStatus('appointment-1', 'other-user', {
          status: ApptStatus.COMPLETED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if appointment is already CANCELED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...appointmentMock,
        status: ApptStatus.CANCELED,
      });
      mockPrisma.user.findUnique.mockResolvedValue(ownerUserMock);

      await expect(
        service.updateAppointmentStatus('appointment-1', 'owner-1', {
          status: ApptStatus.COMPLETED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if marking COMPLETED but appointment is not CONFIRMED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...appointmentMock,
        status: ApptStatus.PENDING_PAYMENT,
      });
      mockPrisma.user.findUnique.mockResolvedValue(ownerUserMock);

      await expect(
        service.updateAppointmentStatus('appointment-1', 'owner-1', {
          status: ApptStatus.COMPLETED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update status to COMPLETED for company owner when CONFIRMED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(appointmentMock);
      mockPrisma.user.findUnique.mockResolvedValue(ownerUserMock);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentMock,
        status: ApptStatus.COMPLETED,
      });

      const result = await service.updateAppointmentStatus(
        'appointment-1',
        'owner-1',
        { status: ApptStatus.COMPLETED },
      );

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appointment-1' },
        data: { status: ApptStatus.COMPLETED },
      });
      expect(result.status).toEqual(ApptStatus.COMPLETED);
    });

    it('should successfully update status to CANCELED and deactivate appointment', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(appointmentMock);
      mockPrisma.user.findUnique.mockResolvedValue(ownerUserMock);
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentMock,
        status: ApptStatus.CANCELED,
        isActive: false,
      });

      const result = await service.updateAppointmentStatus(
        'appointment-1',
        'owner-1',
        { status: ApptStatus.CANCELED },
      );

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appointment-1' },
        data: expect.objectContaining({
          status: ApptStatus.CANCELED,
          isActive: false,
          disabledBy: 'owner-1',
        }),
      });
      expect(result.status).toEqual(ApptStatus.CANCELED);
    });
  });
});
