import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
    },
    scheduleException: {
      findFirst: jest.fn(),
    },
    workingHour: {
      findUnique: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAvailableSlots', () => {
    const mockCompany = {
      id: 'comp-1',
      isActive: true,
      timezone: 'America/Sao_Paulo',
    };

    const mockService = {
      id: 'serv-1',
      companyId: 'comp-1',
      isActive: true,
      durationMinutes: 30,
      serviceGroupId: 'grp-1',
      serviceGroup: {
        id: 'grp-1',
        capacity: 1,
      },
    };

    it('should throw NotFoundException if company is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.getAvailableSlots('comp-invalid', 'serv-1', '2026-08-25'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if service is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(null);

      await expect(
        service.getAvailableSlots('comp-1', 'serv-invalid', '2026-08-25'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if service does not belong to company', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue({
        ...mockService,
        companyId: 'other-comp',
      });

      await expect(
        service.getAvailableSlots('comp-1', 'serv-1', '2026-08-25'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty array if day has closed schedule exception (holiday)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(mockService);
      mockPrisma.scheduleException.findFirst.mockResolvedValue({
        isClosed: true,
      });

      const result = await service.getAvailableSlots(
        'comp-1',
        'serv-1',
        '2026-12-25',
      );
      expect(result).toEqual({
        date: '2026-12-25',
        totalAvailable: 0,
        slots: [],
      });
    });

    it('should return empty array if working hour for the day is closed', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(mockService);
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        isClosed: true,
      });

      const result = await service.getAvailableSlots(
        'comp-1',
        'serv-1',
        '2026-08-23', // Sunday
      );
      expect(result.slots).toEqual([]);
      expect(result.totalAvailable).toBe(0);
    });

    it('should correctly calculate slots and exclude lunch intervals (09:00 - 18:00, lunch 12:00 - 13:00)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(mockService);
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '18:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        isClosed: false,
      });
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const futureDate = '2029-08-28'; // A future Tuesday
      const result = await service.getAvailableSlots(
        'comp-1',
        'serv-1',
        futureDate,
      );

      expect(result.date).toBe(futureDate);
      expect(result.slots).toContain('09:00');
      expect(result.slots).toContain('11:30');
      // Slots during lunch must be excluded
      expect(result.slots).not.toContain('12:00');
      expect(result.slots).not.toContain('12:30');
      // Slots after lunch must be present
      expect(result.slots).toContain('13:00');
      expect(result.slots).toContain('17:30');
      // Slot at 18:00 with 30m duration exceeds closing time (ends 18:30 > 18:00)
      expect(result.slots).not.toContain('18:00');
    });

    it('should exclude slots that exceed capacity (single chair vs multi chair)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(mockService); // capacity = 1
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '12:00',
        lunchStartTime: null,
        lunchEndTime: null,
        isClosed: false,
      });

      const futureDate = '2029-08-28';
      // Existing appointment at 10:00 - 10:30 no fuso de SP
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          appointmentDate: fromZonedTime(
            '2029-08-28T10:00:00',
            'America/Sao_Paulo',
          ),
          appointmentEndDate: fromZonedTime(
            '2029-08-28T10:30:00',
            'America/Sao_Paulo',
          ),
        },
      ]);

      const result = await service.getAvailableSlots(
        'comp-1',
        'serv-1',
        futureDate,
      );

      expect(result.slots).toContain('09:00');
      expect(result.slots).toContain('09:30');
      expect(result.slots).not.toContain('10:00'); // Occupied
      expect(result.slots).toContain('10:30');
      expect(result.slots).toContain('11:00');
      expect(result.slots).toContain('11:30');
    });

    it('should keep slot available when overlapping count is less than capacity (multi-chair)', async () => {
      const multiChairService = {
        ...mockService,
        serviceGroup: {
          id: 'grp-1',
          capacity: 2, // 2 chairs
        },
      };

      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(multiChairService);
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '12:00',
        lunchStartTime: null,
        lunchEndTime: null,
        isClosed: false,
      });

      const futureDate = '2029-08-28';
      // 1 appointment at 10:00 - 10:30 with capacity = 2 no fuso de SP
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          appointmentDate: fromZonedTime(
            '2029-08-28T10:00:00',
            'America/Sao_Paulo',
          ),
          appointmentEndDate: fromZonedTime(
            '2029-08-28T10:30:00',
            'America/Sao_Paulo',
          ),
        },
      ]);

      const result = await service.getAvailableSlots(
        'comp-1',
        'serv-1',
        futureDate,
      );

      // Since capacity is 2 and only 1 appointment exists, 10:00 is still available
      expect(result.slots).toContain('10:00');
    });

    it('should correctly handle heterogeneous service durations (30 min booking vs 60 min service query)', async () => {
      const longService = {
        ...mockService,
        durationMinutes: 60, // 60 minutes service
        serviceGroup: {
          id: 'grp-1',
          capacity: 1, // 1 chair
        },
      };

      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
      mockPrisma.service.findUnique.mockResolvedValue(longService);
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '12:00',
        lunchStartTime: null,
        lunchEndTime: null,
        isClosed: false,
      });

      const futureDate = '2029-08-28';
      // Existing 30-min appointment at 09:30 - 10:00 no fuso de SP
      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          appointmentDate: fromZonedTime(
            '2029-08-28T09:30:00',
            'America/Sao_Paulo',
          ),
          appointmentEndDate: fromZonedTime(
            '2029-08-28T10:00:00',
            'America/Sao_Paulo',
          ),
        },
      ]);

      const result = await service.getAvailableSlots(
        'comp-1',
        'serv-1',
        futureDate,
      );

      // Slot 09:00 (09:00-10:00) collides with 09:30-10:00 -> excluded
      expect(result.slots).not.toContain('09:00');
      // Slot 09:30 (09:30-10:30) collides with 09:30-10:00 -> excluded
      expect(result.slots).not.toContain('09:30');
      // Slots 10:00, 10:30, 11:00 are available
      expect(result.slots).toContain('10:00');
      expect(result.slots).toContain('10:30');
      expect(result.slots).toContain('11:00');
      expect(result.slots).toEqual(['10:00', '10:30', '11:00']);
    });
  });

  describe('validateSlotWithinWorkingHours', () => {
    it('should throw BadRequestException if company is closed on the date', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });
      mockPrisma.scheduleException.findFirst.mockResolvedValue({
        isClosed: true,
      });

      const startDate = fromZonedTime(
        '2026-12-25T10:00:00',
        'America/Sao_Paulo',
      );
      const endDate = fromZonedTime('2026-12-25T10:30:00', 'America/Sao_Paulo');

      await expect(
        service.validateSlotWithinWorkingHours('comp-1', startDate, endDate),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if appointment has non-zero seconds or milliseconds', async () => {
      const startWithSeconds = new Date('2026-08-24T14:00:15.000Z');
      const endDate = new Date('2026-08-24T14:30:00.000Z');

      await expect(
        service.validateSlotWithinWorkingHours(
          'comp-1',
          startWithSeconds,
          endDate,
        ),
      ).rejects.toThrow(
        'Horário do agendamento deve conter segundos e milissegundos zerados.',
      );
    });

    it('should throw BadRequestException if appointment is misaligned with 30-min grid (ex: 09:07)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        lunchStartTime: null,
        lunchEndTime: null,
        isClosed: false,
      });

      const misalignedStart = fromZonedTime(
        '2026-08-24T09:07:00',
        'America/Sao_Paulo',
      );
      const misalignedEnd = fromZonedTime(
        '2026-08-24T09:37:00',
        'America/Sao_Paulo',
      );

      await expect(
        service.validateSlotWithinWorkingHours(
          'comp-1',
          misalignedStart,
          misalignedEnd,
        ),
      ).rejects.toThrow('não está alinhado com a grade de agendamentos');
    });

    it('should throw BadRequestException if appointment is outside working hours', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        lunchStartTime: null,
        lunchEndTime: null,
        isClosed: false,
      });

      const earlyStart = fromZonedTime(
        '2026-08-24T08:00:00',
        'America/Sao_Paulo',
      );
      const earlyEnd = fromZonedTime(
        '2026-08-24T08:30:00',
        'America/Sao_Paulo',
      );

      await expect(
        service.validateSlotWithinWorkingHours('comp-1', earlyStart, earlyEnd),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if appointment intercepts lunch break', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        isClosed: false,
      });

      const lunchStart = fromZonedTime(
        '2026-08-24T12:00:00',
        'America/Sao_Paulo',
      );
      const lunchEnd = fromZonedTime(
        '2026-08-24T12:30:00',
        'America/Sao_Paulo',
      );

      await expect(
        service.validateSlotWithinWorkingHours('comp-1', lunchStart, lunchEnd),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass validation when slot is within working hours and outside lunch (America/Sao_Paulo)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        isClosed: false,
      });

      const validStart = fromZonedTime(
        '2026-08-24T16:00:00',
        'America/Sao_Paulo',
      );
      const validEnd = fromZonedTime(
        '2026-08-24T16:30:00',
        'America/Sao_Paulo',
      );

      await expect(
        service.validateSlotWithinWorkingHours('comp-1', validStart, validEnd),
      ).resolves.not.toThrow();
    });

    it('should pass validation for Manaus timezone (America/Manaus) with 1h difference in UTC', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        timezone: 'America/Manaus',
      });
      mockPrisma.scheduleException.findFirst.mockResolvedValue(null);
      mockPrisma.workingHour.findUnique.mockResolvedValue({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        lunchStartTime: null,
        lunchEndTime: null,
        isClosed: false,
      });

      // 16:00 em Manaus (UTC-4) é 20:00Z
      const manausStart = fromZonedTime(
        '2026-08-24T16:00:00',
        'America/Manaus',
      );
      const manausEnd = fromZonedTime('2026-08-24T16:30:00', 'America/Manaus');

      expect(manausStart.toISOString()).toBe('2026-08-24T20:00:00.000Z');

      await expect(
        service.validateSlotWithinWorkingHours(
          'comp-1',
          manausStart,
          manausEnd,
          'America/Manaus',
        ),
      ).resolves.not.toThrow();
    });
  });
});
