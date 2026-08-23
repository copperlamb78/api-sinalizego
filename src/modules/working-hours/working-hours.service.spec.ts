import { Test, TestingModule } from '@nestjs/testing';
import { WorkingHoursService } from './working-hours.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

describe('WorkingHoursService', () => {
  let service: WorkingHoursService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    workingHour: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    scheduleException: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkingHoursService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WorkingHoursService>(WorkingHoursService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateWorkingHours', () => {
    it('should throw BadRequestException if startTime >= endTime', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        userId: 'user-1',
        isActive: true,
      });

      const dto = {
        hours: [
          {
            dayOfWeek: 1,
            isClosed: false,
            startTime: '18:00',
            endTime: '09:00',
          },
        ],
      };

      await expect(service.updateWorkingHours('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if lunch interval is outside work hours', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        userId: 'user-1',
        isActive: true,
      });

      const dto = {
        hours: [
          {
            dayOfWeek: 1,
            isClosed: false,
            startTime: '09:00',
            endTime: '18:00',
            lunchStartTime: '18:30',
            lunchEndTime: '19:30',
          },
        ],
      };

      await expect(service.updateWorkingHours('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if user tries to update another company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-2',
        userId: 'other-user',
      });

      const dto = {
        companyId: 'comp-2',
        hours: [{ dayOfWeek: 0, isClosed: true }],
      };

      await expect(service.updateWorkingHours('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should successfully update working hours for owned company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        userId: 'user-1',
        isActive: true,
      });

      const expectedHours = [
        {
          id: 'wh-1',
          companyId: 'comp-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '19:00',
          lunchStartTime: '12:00',
          lunchEndTime: '13:00',
          isClosed: false,
        },
      ];
      mockPrisma.workingHour.findMany.mockResolvedValue(expectedHours);

      const dto = {
        hours: [
          {
            dayOfWeek: 1,
            isClosed: false,
            startTime: '09:00',
            endTime: '19:00',
            lunchStartTime: '12:00',
            lunchEndTime: '13:00',
          },
        ],
      };

      const result = await service.updateWorkingHours('user-1', dto);
      expect(mockPrisma.workingHour.upsert).toHaveBeenCalled();
      expect(result).toEqual(expectedHours);
    });
  });

  describe('getWorkingHours', () => {
    it('should return working hours for user company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        userId: 'user-1',
        isActive: true,
      });

      const expectedHours = [{ id: 'wh-1', dayOfWeek: 1, isClosed: false }];
      mockPrisma.workingHour.findMany.mockResolvedValue(expectedHours);

      const result = await service.getWorkingHours('user-1');
      expect(result).toEqual(expectedHours);
    });
  });

  describe('getWorkingHoursByCompanyId', () => {
    it('should throw NotFoundException if company does not exist or is inactive', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.getWorkingHoursByCompanyId('comp-invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return working hours for active company publicly', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        isActive: true,
      });
      const expectedHours = [{ id: 'wh-1', dayOfWeek: 1, isClosed: false }];
      mockPrisma.workingHour.findMany.mockResolvedValue(expectedHours);

      const result = await service.getWorkingHoursByCompanyId('comp-1');
      expect(result).toEqual(expectedHours);
    });
  });

  describe('createScheduleException', () => {
    it('should throw BadRequestException if open exception has invalid time', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        userId: 'user-1',
        isActive: true,
      });

      const dto = {
        date: '2026-12-25',
        isClosed: false,
        startTime: '15:00',
        endTime: '10:00',
      };

      await expect(
        service.createScheduleException('user-1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create schedule exception successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        userId: 'user-1',
        isActive: true,
      });

      const createdException = {
        id: 'exc-1',
        companyId: 'comp-1',
        date: new Date('2026-12-25'),
        isClosed: true,
        description: 'Feriado de Natal',
      };
      mockPrisma.scheduleException.create.mockResolvedValue(createdException);

      const dto = {
        date: '2026-12-25',
        isClosed: true,
        description: 'Feriado de Natal',
      };

      const result = await service.createScheduleException('user-1', dto);
      expect(result).toEqual(createdException);
    });
  });

  describe('deleteScheduleException', () => {
    it('should throw NotFoundException if exception is not found', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteScheduleException('exc-invalid', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if exception belongs to another company', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue({
        id: 'exc-1',
        company: { userId: 'other-user' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });

      await expect(
        service.deleteScheduleException('exc-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deactivate schedule exception for owner', async () => {
      mockPrisma.scheduleException.findUnique.mockResolvedValue({
        id: 'exc-1',
        company: { userId: 'user-1' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.COMPANY_OWNER,
      });
      const updated = { id: 'exc-1', isActive: false };
      mockPrisma.scheduleException.update.mockResolvedValue(updated);

      const result = await service.deleteScheduleException('exc-1', 'user-1');
      expect(result).toEqual(updated);
    });
  });
});
