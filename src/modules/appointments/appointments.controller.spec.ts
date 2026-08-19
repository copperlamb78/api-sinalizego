import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ApptStatus } from '@prisma/client';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: AppointmentsService;

  const mockAppointmentsService = {
    createAppointment: jest.fn(),
    getAppointments: jest.fn(),
    getAppointmentByCompanyId: jest.fn(),
    getAppointmentByUserId: jest.fn(),
    updateAppointmentStatus: jest.fn(),
    deactivateAppointment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        {
          provide: AppointmentsService,
          useValue: mockAppointmentsService,
        },
      ],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an appointment for the authenticated client', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const dto = {
        companyId: 'company-1',
        serviceId: 'service-1',
        appointmentDate: '2026-08-20T10:00:00.000Z',
      };
      const expected = { id: 'appointment-1', ...dto, clientId: 'client-1', status: 'PENDING_PAYMENT' };
      mockAppointmentsService.createAppointment.mockResolvedValue(expected);

      const result = await controller.create(dto as any, req);
      expect(service.createAppointment).toHaveBeenCalledWith(dto, 'client-1');
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return all appointments for super admin', async () => {
      const filters = {} as any;
      const expected = [{ id: 'appointment-1', status: 'CONFIRMED' }];
      mockAppointmentsService.getAppointments.mockResolvedValue(expected);

      const result = await controller.findAll(filters);
      expect(service.getAppointments).toHaveBeenCalledWith(filters);
      expect(result).toEqual(expected);
    });
  });

  describe('findByCompany', () => {
    it('should return appointments for the user company', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const filters = {} as any;
      const expected = [{ id: 'appointment-1', status: 'CONFIRMED' }];
      mockAppointmentsService.getAppointmentByCompanyId.mockResolvedValue(expected);

      const result = await controller.findByCompany(req, filters);
      expect(service.getAppointmentByCompanyId).toHaveBeenCalledWith('owner-1', filters);
      expect(result).toEqual(expected);
    });
  });

  describe('findByUser', () => {
    it('should return appointments for the client', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const filters = {} as any;
      const expected = [{ id: 'appointment-1', status: 'CONFIRMED' }];
      mockAppointmentsService.getAppointmentByUserId.mockResolvedValue(expected);

      const result = await controller.findByUser(req, filters);
      expect(service.getAppointmentByUserId).toHaveBeenCalledWith('client-1', filters);
      expect(result).toEqual(expected);
    });
  });

  describe('updateStatus', () => {
    it('should update appointment status with authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const dto = { status: ApptStatus.COMPLETED };
      const expected = { id: 'appointment-1', status: ApptStatus.COMPLETED };
      mockAppointmentsService.updateAppointmentStatus.mockResolvedValue(expected);

      const result = await controller.updateStatus('f1e2d3c4-b5a6-0987-6543-210fedcba987', dto, req);
      expect(service.updateAppointmentStatus).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deactivate', () => {
    it('should deactivate / cancel appointment', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const expected = { id: 'appointment-1', isActive: false, status: 'CANCELED' };
      mockAppointmentsService.deactivateAppointment.mockResolvedValue(expected);

      const result = await controller.deactivate('f1e2d3c4-b5a6-0987-6543-210fedcba987', req);
      expect(service.deactivateAppointment).toHaveBeenCalledWith('f1e2d3c4-b5a6-0987-6543-210fedcba987', 'client-1');
      expect(result).toEqual(expected);
    });
  });
});
