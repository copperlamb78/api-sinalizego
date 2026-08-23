import { Test, TestingModule } from '@nestjs/testing';
import { WorkingHoursController } from './working-hours.controller';
import { WorkingHoursService } from './working-hours.service';

describe('WorkingHoursController', () => {
  let controller: WorkingHoursController;
  let service: WorkingHoursService;

  const mockWorkingHoursService = {
    updateWorkingHours: jest.fn(),
    getWorkingHours: jest.fn(),
    getWorkingHoursByCompanyId: jest.fn(),
    createScheduleException: jest.fn(),
    getScheduleExceptions: jest.fn(),
    deleteScheduleException: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkingHoursController],
      providers: [
        {
          provide: WorkingHoursService,
          useValue: mockWorkingHoursService,
        },
      ],
    }).compile();

    controller = module.get<WorkingHoursController>(WorkingHoursController);
    service = module.get<WorkingHoursService>(WorkingHoursService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateWorkingHours', () => {
    it('should call workingHoursService.updateWorkingHours with req.user.sub', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = {
        hours: [
          {
            dayOfWeek: 1,
            isClosed: false,
            startTime: '09:00',
            endTime: '18:00',
          },
        ],
      };
      const expected = [{ dayOfWeek: 1, isClosed: false }];
      mockWorkingHoursService.updateWorkingHours.mockResolvedValue(expected);

      const result = await controller.updateWorkingHours(dto, req);
      expect(service.updateWorkingHours).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('getWorkingHours', () => {
    it('should call workingHoursService.getWorkingHours with req.user.sub and companyId query', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = [{ dayOfWeek: 1, isClosed: false }];
      mockWorkingHoursService.getWorkingHours.mockResolvedValue(expected);

      const result = await controller.getWorkingHours(req, 'comp-1');
      expect(service.getWorkingHours).toHaveBeenCalledWith('user-1', 'comp-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getWorkingHoursByCompany', () => {
    it('should call workingHoursService.getWorkingHoursByCompanyId with param', async () => {
      const expected = [{ dayOfWeek: 1, isClosed: false }];
      mockWorkingHoursService.getWorkingHoursByCompanyId.mockResolvedValue(
        expected,
      );

      const result = await controller.getWorkingHoursByCompany('comp-1');
      expect(service.getWorkingHoursByCompanyId).toHaveBeenCalledWith('comp-1');
      expect(result).toEqual(expected);
    });
  });

  describe('createScheduleException', () => {
    it('should call workingHoursService.createScheduleException with req.user.sub and dto', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = { date: '2026-12-25', isClosed: true };
      const expected = { id: 'exc-1', ...dto };
      mockWorkingHoursService.createScheduleException.mockResolvedValue(
        expected,
      );

      const result = await controller.createScheduleException(dto, req);
      expect(service.createScheduleException).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getScheduleExceptions', () => {
    it('should call workingHoursService.getScheduleExceptions with req.user.sub', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = [{ id: 'exc-1', date: new Date() }];
      mockWorkingHoursService.getScheduleExceptions.mockResolvedValue(expected);

      const result = await controller.getScheduleExceptions(req, undefined);
      expect(service.getScheduleExceptions).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deleteScheduleException', () => {
    it('should call workingHoursService.deleteScheduleException with id and req.user.sub', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'exc-1', isActive: false };
      mockWorkingHoursService.deleteScheduleException.mockResolvedValue(
        expected,
      );

      const result = await controller.deleteScheduleException('exc-1', req);
      expect(service.deleteScheduleException).toHaveBeenCalledWith(
        'exc-1',
        'user-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
