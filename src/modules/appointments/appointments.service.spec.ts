import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApptStatus, Role, TransactionStatus } from '@prisma/client';

import { CalculateDeposit } from 'src/helpers/calculate-deposit.helper';
import { AsaasService } from 'src/asaas/asaas.service';
import { AvailabilityService } from './availability.service';
import { MailService } from '../mail/mail.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;
  let asaasService: AsaasService;
  let mailService: MailService;

  const mockPrisma = {
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    company: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    service: {
      findFirst: jest.fn(),
    },
    companyService: {
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn((cb) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
    ),
  };

  const mockCalculateTax = {
    calculatePlatformTax: jest.fn().mockReturnValue(7.5),
    calculatePlatformTaxPercentage: jest.fn().mockReturnValue(0.15),
  };

  const mockAsaasService = {
    cancelPayment: jest.fn().mockResolvedValue(true),
    refundPayment: jest.fn().mockResolvedValue(true),
  };

  const mockAvailabilityService = {
    validateSlotWithinWorkingHours: jest.fn().mockResolvedValue(undefined),
    getAvailableSlots: jest.fn(),
  };

  const mockMailService = {
    sendAppointmentConfirmationEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentCancellationEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentReminderEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        CalculateDeposit,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CalculateTax,
          useValue: mockCalculateTax,
        },
        {
          provide: AsaasService,
          useValue: mockAsaasService,
        },
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasService = module.get<AsaasService>(AsaasService);
    mailService = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAppointment', () => {
    const mockUser = {
      id: 'user-1',
      cpfCnpj: '12345678900',
    };

    const mockCompany = {
      id: 'company-1',
      userId: 'owner-1',
    };

    const mockService = {
      id: 'service-1',
      companyId: 'company-1',
      durationMinutes: 30,
      totalPrice: 50.0,
      downPaymentPercent: 50,
      serviceGroup: { capacity: 2 },
    };

    it('should create appointment with correct downPayment and platformFeeAmount in Reais', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockCalculateTax.calculatePlatformTax.mockReturnValue(3.75); // 25.00 * 0.15 = 3.75

      const createdAppointment = {
        id: 'appt-1',
        companyId: 'company-1',
        serviceId: 'service-1',
        clientId: 'user-1',
        servicePrice: 50.0,
        downPaymentAmount: 25.0,
        platformFeeAmount: 3.75,
      };
      mockPrisma.appointment.create.mockResolvedValue(createdAppointment);

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(mockCalculateTax.calculatePlatformTax).toHaveBeenCalledWith(25.0);
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            servicePrice: 50.0,
            downPaymentAmount: 25.0,
            platformFeeAmount: 3.75,
          }),
        }),
      );
      expect(result).toEqual(createdAppointment);
    });

    it('should strictly enforce 100% upfront for service price below R$ 15.00', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      // Serviço de R$ 12,00 com piso 50% -> Força R$ 12,00 (100%)
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        totalPrice: 12.0,
        downPaymentPercent: 50,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockCalculateTax.calculatePlatformTax.mockReturnValue(2.0);

      const createdAppointment = {
        id: 'appt-below-15',
        companyId: 'company-1',
        serviceId: 'service-1',
        clientId: 'user-1',
        servicePrice: 12.0,
        downPaymentAmount: 12.0,
        platformFeeAmount: 2.0,
      };
      mockPrisma.appointment.create.mockResolvedValue(createdAppointment);

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            servicePrice: 12.0,
            downPaymentAmount: 12.0,
            platformFeeAmount: 2.0,
          }),
        }),
      );
      expect(result.downPaymentAmount).toBe(12.0);
    });

    it('should calculate 50% deposit for R$ 100 service regardless of client inputs', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        totalPrice: 100.0,
        downPaymentPercent: 50,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockCalculateTax.calculatePlatformTax.mockReturnValue(12.5);

      mockPrisma.appointment.create.mockResolvedValue({
        id: 'appt-100',
        downPaymentAmount: 50.0,
      });

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            servicePrice: 100.0,
            downPaymentAmount: 50.0,
          }),
        }),
      );
      expect(result.downPaymentAmount).toBe(50.0);
    });

    it('should throw HttpException TOO_MANY_REQUESTS if client has 3 or more cancellations in the current week (Anti-Abuse)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.appointment.count.mockResolvedValueOnce(3); // 3 cancelamentos na semana

      await expect(
        service.createAppointment(
          {
            companyId: 'company-1',
            serviceId: 'service-1',
            appointmentDate: '2026-09-01T10:00:00Z',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(
        new HttpException(
          'Sua conta atingiu o limite de 3 cancelamentos nesta semana. Por motivos de segurança e prevenção de abusos, novos agendamentos estão temporariamente bloqueados.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });

    it('should throw BadRequestException if client already has 2 concurrent active appointments (Anti-DoS / Concorrência)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.appointment.count
        .mockResolvedValueOnce(0) // 0 cancelamentos
        .mockResolvedValueOnce(2); // 2 agendamentos ativos

      await expect(
        service.createAppointment(
          {
            companyId: 'company-1',
            serviceId: 'service-1',
            appointmentDate: '2026-09-01T10:00:00Z',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Você atingiu o limite de 2 agendamentos ativos simultâneos. Conclua ou aguarde a realização dos seus agendamentos para criar novas reservas.',
        ),
      );
    });

    it('should throw BadRequestException if appointmentDate is in the past or invalid', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);

      await expect(
        service.createAppointment(
          {
            companyId: 'company-1',
            serviceId: 'service-1',
            appointmentDate: '2020-01-01T10:00:00Z', // data no passado
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'A data do agendamento deve ser uma data futura.',
        ),
      );
    });

    it('should query slots using canonical overlap check grouped by serviceGroupId and excluding expired pending bookings', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        serviceGroupId: 'group-1',
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]); // Nenhuma reserva ativa não-expirada ocupando vaga
      mockPrisma.appointment.create.mockResolvedValue({ id: 'appt-new' });

      await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(mockPrisma.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
            isActive: true,
            status: { notIn: [ApptStatus.CANCELED] },
            appointmentDate: { lt: expect.any(Date) },
            appointmentEndDate: { gt: expect.any(Date) },
            service: {
              serviceGroupId: 'group-1',
            },
            OR: [
              { status: { not: ApptStatus.PENDING_PAYMENT } },
              { expiresAt: expect.any(Object) },
            ],
          }),
        }),
      );
    });

    it('should throw ConflictException if group capacity is reached due to overlapping appointments', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        serviceGroupId: 'group-1',
        serviceGroup: { capacity: 1 }, // Capacidade de apenas 1 atendimento simultâneo
      });
      // 1. Cancelamentos semanais = 0; 2. Limite por cliente = 0; 3. Sobreposição de capacidade = 1 (capacidade atingida)
      mockPrisma.appointment.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      await expect(
        service.createAppointment(
          {
            companyId: 'company-1',
            serviceId: 'service-1',
            appointmentDate: '2026-09-01T10:00:00Z',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should correctly calculate 50% deposit for standard R$ 60.00 service -> R$ 30.00 deposit', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        totalPrice: 60.0,
        downPaymentPercent: 50,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.create.mockImplementation((args) => args.data);

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(result.downPaymentAmount).toBe(30.0);
    });

    it('should correctly apply R$ 15.00 safety floor for R$ 20.00 service -> R$ 15.00 deposit', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        totalPrice: 20.0,
        downPaymentPercent: 50,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.create.mockImplementation((args) => args.data);

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(result.downPaymentAmount).toBe(15.0);
    });

    it('should correctly calculate 30% deposit for high-ticket R$ 500.00 service -> R$ 150.00 deposit', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        totalPrice: 500.0,
        downPaymentPercent: 30,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.create.mockImplementation((args) => args.data);

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(result.downPaymentAmount).toBe(150.0);
    });

    it('should correctly calculate 50% deposit for high-ticket R$ 500.00 service configured with 50% -> R$ 250.00 deposit', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.service.findFirst.mockResolvedValue({
        ...mockService,
        totalPrice: 500.0,
        downPaymentPercent: 50,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.appointment.create.mockImplementation((args) => args.data);

      const result = await service.createAppointment(
        {
          companyId: 'company-1',
          serviceId: 'service-1',
          appointmentDate: '2026-09-01T10:00:00Z',
        } as any,
        'user-1',
      );

      expect(result.downPaymentAmount).toBe(250.0);
    });
  });

  describe('getAppointmentByUserId', () => {
    it('should query appointments strictly filtering by clientId', async () => {
      const expected = [{ id: 'appointment-1', clientId: 'client-123' }];
      mockPrisma.appointment.findMany.mockResolvedValue(expected);

      const result = await service.getAppointmentByUserId('client-123');

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        select: expect.any(Object),
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getAppointmentByCompanyId', () => {
    it('should return empty list if user has no companies', async () => {
      mockPrisma.company.findMany.mockResolvedValue([]);

      const result = await service.getAppointmentByCompanyId(
        'owner-without-company',
      );

      expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
        where: { userId: 'owner-without-company' },
        select: { id: true },
      });
      expect(result).toEqual([]);
    });

    it('should scope query to all companies owned by user when no companyId filter is passed', async () => {
      mockPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1' },
        { id: 'company-2' },
      ]);
      const expected = [{ id: 'appointment-1', companyId: 'company-1' }];
      mockPrisma.appointment.findMany.mockResolvedValue(expected);

      const result = await service.getAppointmentByCompanyId('owner-1');

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: { companyId: { in: ['company-1', 'company-2'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        select: expect.any(Object),
      });
      expect(result).toEqual(expected);
    });

    it('should throw ForbiddenException if user tries to query a companyId they do not own (IDOR)', async () => {
      mockPrisma.company.findMany.mockResolvedValue([{ id: 'company-1' }]);

      await expect(
        service.getAppointmentByCompanyId('owner-1', {
          companyId: 'competitor-company-99',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow querying specific companyId if user is the owner', async () => {
      mockPrisma.company.findMany.mockResolvedValue([
        { id: 'company-1' },
        { id: 'company-2' },
      ]);
      const expected = [{ id: 'appointment-1', companyId: 'company-1' }];
      mockPrisma.appointment.findMany.mockResolvedValue(expected);

      const result = await service.getAppointmentByCompanyId('owner-1', {
        companyId: 'company-1',
      } as any);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
        select: expect.any(Object),
      });
      expect(result).toEqual(expected);
    });
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

  describe('deactivateAppointment', () => {
    const appointmentMock = {
      id: 'appointment-1',
      clientId: 'client-1',
      status: ApptStatus.CONFIRMED,
      isActive: true,
      company: {
        id: 'company-1',
        userId: 'owner-1',
      },
    };

    it('should throw ForbiddenException if user is neither client, nor company owner, nor admin', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(appointmentMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'stranger-id',
        role: Role.CLIENT,
      });

      await expect(
        service.deactivateAppointment('appointment-1', 'stranger-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow client to deactivate their own appointment', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(appointmentMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'client-1',
        role: Role.CLIENT,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        ...appointmentMock,
        status: ApptStatus.CANCELED,
        isActive: false,
      });

      const result = await service.deactivateAppointment(
        'appointment-1',
        'client-1',
      );

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appointment-1' },
        data: expect.objectContaining({
          status: ApptStatus.CANCELED,
          isActive: false,
          disabledBy: 'client-1',
        }),
      });
      expect(result.status).toEqual(ApptStatus.CANCELED);
    });
  });

  describe('handleExpiredAppointments (Cron Job)', () => {
    it('should return 0 if no appointments are expired', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      const result = await service.handleExpiredAppointments();
      expect(result).toBe(0);
    });

    it('should cancel expired PENDING_PAYMENT appointments and trigger Asaas cancellation', async () => {
      const expiredAppt = {
        id: 'appt-expired-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        transactions: [
          {
            id: 'tx-1',
            asaasPaymentId: 'pay_12345',
            status: 'PENDING',
          },
        ],
      };

      mockPrisma.appointment.findMany.mockResolvedValue([expiredAppt]);
      mockPrisma.appointment.update.mockResolvedValue({
        ...expiredAppt,
        status: ApptStatus.CANCELED,
        isActive: false,
      });

      const result = await service.handleExpiredAppointments();

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-expired-1' },
        data: {
          status: ApptStatus.CANCELED,
          isActive: false,
        },
      });
      expect(asaasService.cancelPayment).toHaveBeenCalledWith('pay_12345');
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: 'CANCELED' },
      });
      expect(result).toBe(1);
    });
  });

  describe('completeAppointment', () => {
    it('should throw NotFoundException if appointment does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.completeAppointment('appt-invalid', 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.completeAppointment('appt-1', 'user-invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the appointment company (Anti-IDOR)', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        company: { userId: 'owner-real' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'attacker-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.completeAppointment('appt-1', 'attacker-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if appointment is already COMPLETED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.COMPLETED,
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.completeAppointment('appt-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if appointment is CANCELED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.CANCELED,
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.completeAppointment('appt-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if appointment is PENDING_PAYMENT', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.completeAppointment('appt-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if appointmentDate is in the future', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
        appointmentDate: new Date(Date.now() + 60 * 60 * 1000), // 1h no futuro
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.completeAppointment('appt-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully complete a CONFIRMED appointment when appointmentDate is past or now', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
        appointmentDate: new Date(Date.now() - 30 * 60 * 1000), // 30min no passado
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });
      const expectedCompleted = {
        id: 'appt-1',
        status: ApptStatus.COMPLETED,
      };
      mockPrisma.appointment.update.mockResolvedValue(expectedCompleted);

      const result = await service.completeAppointment('appt-1', 'owner-1');
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.COMPLETED },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedCompleted);
    });
  });

  describe('markAsNoShow (Loss Prevention & Retained Deposit)', () => {
    it('should throw NotFoundException if appointment does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(service.markAsNoShow('appt-99', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not company owner or admin', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        company: { userId: 'other-owner' },
        service: { totalPrice: 100 },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-intruder',
        role: Role.CLIENT,
      });

      await expect(
        service.markAsNoShow('appt-1', 'user-intruder'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if appointment is not CONFIRMED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.markAsNoShow('appt-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if less than 15 minutes have passed since appointmentDate', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
        appointmentDate: new Date(Date.now() + 10 * 60 * 1000), // no futuro
        company: { userId: 'owner-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.markAsNoShow('appt-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully mark as NO_SHOW and retain deposit when >= 15 min past start time', async () => {
      const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 min atrás (> 15 min de tolerância)
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
        appointmentDate: pastDate,
        downPaymentAmount: 40.0,
        company: { userId: 'owner-1' },
        service: { id: 'srv-1', name: 'Corte', totalPrice: 80 },
        client: { id: 'cli-1', name: 'João', email: 'joao@test.com' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });

      const expectedNoShow = {
        id: 'appt-1',
        status: ApptStatus.NO_SHOW,
        retainedDepositAmount: 40.0,
      };
      mockPrisma.appointment.update.mockResolvedValue(expectedNoShow);

      const result = await service.markAsNoShow('appt-1', 'owner-1');
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: {
          status: ApptStatus.NO_SHOW,
          retainedDepositAmount: 40.0,
          disabledAt: expect.any(Date),
          disabledBy: 'owner-1',
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedNoShow);
    });
  });

  describe('deactivateAppointment (Cancellation & Email)', () => {
    it('should trigger full Asaas refund and send cancellation email when canceled > 24h before', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h no futuro
      const apptMock = {
        id: 'appt-1',
        appointmentDate: futureDate,
        status: ApptStatus.CONFIRMED,
        isActive: true,
        servicePrice: 100.0,
        downPaymentAmount: 50.0,
        company: {
          userId: 'owner-1',
          businessName: 'Barbearia VIP',
          timezone: 'America/Sao_Paulo',
        },
        client: {
          id: 'client-1',
          name: 'Cliente Teste',
          email: 'cliente@test.com',
        },
        service: {
          id: 'srv-1',
          name: 'Corte Degradê',
          totalPrice: 100,
          downPaymentPercent: 50,
        },
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(apptMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        appointmentId: 'appt-1',
        asaasPaymentId: 'pay_123',
        totalValue: 55.0, // R$ 50 sinal + R$ 5 taxa plataforma
        status: TransactionStatus.CONFIRMED,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        ...apptMock,
        status: ApptStatus.CANCELED,
        isActive: false,
      });

      const result = await service.deactivateAppointment('appt-1', 'owner-1');

      expect(mockAsaasService.refundPayment).toHaveBeenCalledWith(
        'pay_123',
        undefined,
        'Cancelamento com antecedência superior a 24 horas (estorno integral).',
      );
      expect(
        mockMailService.sendAppointmentCancellationEmail,
      ).toHaveBeenCalledWith(
        'cliente@test.com',
        expect.objectContaining({
          customerName: 'Cliente Teste',
          companyName: 'Barbearia VIP',
          isRefunded: true,
          refundAmount: 55.0,
        }),
      );
      expect(result.status).toBe(ApptStatus.CANCELED);
    });

    it('should NOT trigger Asaas refund when canceled <= 24h before appointment, retaining 100% of deposit (Regra N6)', async () => {
      const nearFutureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h no futuro
      const apptMock = {
        id: 'appt-1',
        appointmentDate: nearFutureDate,
        status: ApptStatus.CONFIRMED,
        isActive: true,
        servicePrice: 100.0,
        downPaymentAmount: 50.0,
        company: {
          userId: 'owner-1',
          businessName: 'Barbearia VIP',
          timezone: 'America/Sao_Paulo',
        },
        client: {
          id: 'client-1',
          name: 'Cliente Teste',
          email: 'cliente@test.com',
        },
        service: {
          id: 'srv-1',
          name: 'Corte Degradê',
          totalPrice: 100,
          downPaymentPercent: 50,
        },
      };

      mockPrisma.appointment.findUnique.mockResolvedValue(apptMock);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        appointmentId: 'appt-1',
        asaasPaymentId: 'pay_123',
        totalValue: 55.0,
        status: TransactionStatus.CONFIRMED,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        ...apptMock,
        status: ApptStatus.CANCELED,
        retainedDepositAmount: 50.0,
        isActive: false,
      });

      await service.deactivateAppointment('appt-1', 'owner-1');

      expect(mockAsaasService.refundPayment).not.toHaveBeenCalled();
      expect(
        mockMailService.sendAppointmentCancellationEmail,
      ).toHaveBeenCalledWith(
        'cliente@test.com',
        expect.objectContaining({
          isRefunded: false,
          refundAmount: undefined,
        }),
      );
    });
  });

  describe('sendDailyAppointmentReminders (Cron D-1)', () => {
    it('should send reminder emails for all confirmed appointments scheduled for tomorrow', async () => {
      const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const apptsMock = [
        {
          id: 'appt-1',
          appointmentDate: tomorrowDate,
          status: ApptStatus.CONFIRMED,
          isActive: true,
          client: { name: 'Cliente 1', email: 'c1@test.com' },
          company: {
            businessName: 'Barbearia VIP',
            street: 'Rua Principal',
            number: '100',
            district: 'Centro',
            city: 'Feira de Santana',
            state: 'BA',
            timezone: 'America/Sao_Paulo',
          },
          service: { name: 'Corte' },
        },
        {
          id: 'appt-2',
          appointmentDate: tomorrowDate,
          status: ApptStatus.CONFIRMED,
          isActive: true,
          client: { name: 'Cliente 2', email: 'c2@test.com' },
          company: {
            businessName: 'Barbearia VIP',
            street: 'Rua Principal',
            number: '100',
            district: 'Centro',
            city: 'Feira de Santana',
            state: 'BA',
            timezone: 'America/Sao_Paulo',
          },
          service: { name: 'Barba' },
        },
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(apptsMock);

      const count = await service.sendDailyAppointmentReminders();

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          status: ApptStatus.CONFIRMED,
          isActive: true,
          appointmentDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        orderBy: { appointmentDate: 'asc' },
        include: expect.any(Object),
      });
      expect(
        mockMailService.sendAppointmentReminderEmail,
      ).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });

    it('should handle individual email errors gracefully without interrupting the batch', async () => {
      const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const apptsMock = [
        {
          id: 'appt-1',
          appointmentDate: tomorrowDate,
          status: ApptStatus.CONFIRMED,
          isActive: true,
          client: { name: 'Cliente 1', email: 'c1@test.com' },
          company: {
            businessName: 'Barbearia VIP',
            street: 'Rua Principal',
            number: '100',
            district: 'Centro',
            city: 'Feira de Santana',
            state: 'BA',
            timezone: 'America/Sao_Paulo',
          },
          service: { name: 'Corte' },
        },
      ];

      mockPrisma.appointment.findMany.mockResolvedValue(apptsMock);
      mockMailService.sendAppointmentReminderEmail.mockRejectedValueOnce(
        new Error('Brevo down'),
      );

      const count = await service.sendDailyAppointmentReminders();

      expect(count).toBe(0);
    });
  });

  describe('autoCompletePastConfirmedAppointments (Cron Auto-Complete & Escrow Release)', () => {
    it('should mark past confirmed appointments as COMPLETED releasing escrow', async () => {
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.autoCompletePastConfirmedAppointments();

      expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
        where: {
          status: ApptStatus.CONFIRMED,
          isActive: true,
          appointmentEndDate: { lte: expect.any(Date) },
        },
        data: {
          status: ApptStatus.COMPLETED,
          disabledBy: 'SYSTEM_AUTO_COMPLETE',
        },
      });
      expect(result).toBe(2);
    });

    it('should return 0 when updateMany completes with count 0', async () => {
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.autoCompletePastConfirmedAppointments();

      expect(result).toBe(0);
    });
  });
});
