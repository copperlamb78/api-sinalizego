import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './availability.service';
import { ApptStatus } from '@prisma/client';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let appointmentsService: AppointmentsService;
  let availabilityService: AvailabilityService;

  const mockAppointmentsService = {
    createAppointment: jest.fn(),
    getAppointments: jest.fn(),
    getAppointmentByCompanyId: jest.fn(),
    getAppointmentByUserId: jest.fn(),
    updateAppointmentStatus: jest.fn(),
    completeAppointment: jest.fn(),
    deactivateAppointment: jest.fn(),
  };

  const mockAvailabilityService = {
    getAvailableSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        {
          provide: AppointmentsService,
          useValue: mockAppointmentsService,
        },
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAvailableSlots', () => {
    it('should return available slots calling availabilityService', async () => {
      const query = {
        companyId: 'company-1',
        serviceId: 'service-1',
        date: '2026-08-25',
      };
      const expected = {
        date: '2026-08-25',
        totalAvailable: 2,
        slots: ['09:00', '09:30'],
      };
      mockAvailabilityService.getAvailableSlots.mockResolvedValue(expected);

      const result = await controller.getAvailableSlots(query);
      expect(availabilityService.getAvailableSlots).toHaveBeenCalledWith(
        'company-1',
        'service-1',
        '2026-08-25',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('should create an appointment for the authenticated client', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const dto = {
        companyId: 'company-1',
        serviceId: 'service-1',
        appointmentDate: '2026-08-20T10:00:00.000Z',
      };
      const expected = {
        id: 'appointment-1',
        ...dto,
        clientId: 'client-1',
        status: 'PENDING_PAYMENT',
      };
      mockAppointmentsService.createAppointment.mockResolvedValue(expected);

      const result = await controller.create(dto as any, req);
      expect(appointmentsService.createAppointment).toHaveBeenCalledWith(
        dto,
        'client-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return all appointments for super admin', async () => {
      const filters = {} as any;
      const expected = [{ id: 'appointment-1', status: 'CONFIRMED' }];
      mockAppointmentsService.getAppointments.mockResolvedValue(expected);

      const result = await controller.findAll(filters);
      expect(appointmentsService.getAppointments).toHaveBeenCalledWith(filters);
      expect(result).toEqual(expected);
    });
  });

  describe('findByCompany', () => {
    it('should return appointments for the user company', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const filters = {} as any;
      const expected = [{ id: 'appointment-1', status: 'CONFIRMED' }];
      mockAppointmentsService.getAppointmentByCompanyId.mockResolvedValue(
        expected,
      );

      const result = await controller.findByCompany(req, filters);
      expect(
        appointmentsService.getAppointmentByCompanyId,
      ).toHaveBeenCalledWith('owner-1', filters);
      expect(result).toEqual(expected);
    });
  });

  describe('findByUser', () => {
    it('should return appointments for the client', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const filters = {} as any;
      const expected = [{ id: 'appointment-1', status: 'CONFIRMED' }];
      mockAppointmentsService.getAppointmentByUserId.mockResolvedValue(
        expected,
      );

      const result = await controller.findByUser(req, filters);
      expect(appointmentsService.getAppointmentByUserId).toHaveBeenCalledWith(
        'client-1',
        filters,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('complete', () => {
    it('should complete a confirmed appointment with authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = { id: 'appointment-1', status: ApptStatus.COMPLETED };
      mockAppointmentsService.completeAppointment.mockResolvedValue(expected);

      const result = await controller.complete(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        req,
      );
      expect(appointmentsService.completeAppointment).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('updateStatus', () => {
    it('should update appointment status with authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const dto = { status: ApptStatus.COMPLETED };
      const expected = { id: 'appointment-1', status: ApptStatus.COMPLETED };
      mockAppointmentsService.updateAppointmentStatus.mockResolvedValue(
        expected,
      );

      const result = await controller.updateStatus(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        dto,
        req,
      );
      expect(appointmentsService.updateAppointmentStatus).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('cancelByClient', () => {
    it('should cancel appointment requested by client', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const expected = {
        id: 'appointment-1',
        isActive: false,
        status: 'CANCELED',
      };
      mockAppointmentsService.deactivateAppointment.mockResolvedValue(expected);

      const result = await controller.cancelByClient(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        req,
      );
      expect(appointmentsService.deactivateAppointment).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'client-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deactivate', () => {
    it('should deactivate / cancel appointment', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const expected = {
        id: 'appointment-1',
        isActive: false,
        status: 'CANCELED',
      };
      mockAppointmentsService.deactivateAppointment.mockResolvedValue(expected);

      const result = await controller.deactivate(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        req,
      );
      expect(appointmentsService.deactivateAppointment).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'client-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
