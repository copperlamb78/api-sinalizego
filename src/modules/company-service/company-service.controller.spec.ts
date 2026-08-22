import { Test, TestingModule } from '@nestjs/testing';
import { CompanyServiceController } from './company-service.controller';
import { CompanyServiceService } from './company-service.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './dto/create-service.dto';

describe('CompanyServiceController', () => {
  let controller: CompanyServiceController;
  let service: CompanyServiceService;

  const mockCompanyServiceService = {
    createService: jest.fn(),
    getServicesByCompany: jest.fn(),
    getServicesBySlug: jest.fn(),
    updateService: jest.fn(),
    deactivateService: jest.fn(),
    activateService: jest.fn(),
    getAllServices: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyServiceController],
      providers: [
        {
          provide: CompanyServiceService,
          useValue: mockCompanyServiceService,
        },
      ],
    }).compile();

    controller = module.get<CompanyServiceController>(CompanyServiceController);
    service = module.get<CompanyServiceService>(CompanyServiceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('CreateServiceDto Validation', () => {
    it('should fail validation when downPaymentPercent is not 25 or 50 (e.g. 30%)', async () => {
      const dto = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 50,
        downPaymentPercent: 30,
        serviceGroupId: 'group-1',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err) => err.property === 'downPaymentPercent')).toBe(
        true,
      );
    });

    it('should pass validation when downPaymentPercent is 25 or 50', async () => {
      const dto25 = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 50,
        downPaymentPercent: 25,
        serviceGroupId: 'group-1',
      });
      const errors25 = await validate(dto25);
      expect(errors25.length).toBe(0);

      const dto50 = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 50,
        downPaymentPercent: 50,
        serviceGroupId: 'group-1',
      });
      const errors50 = await validate(dto50);
      expect(errors50.length).toBe(0);
    });
  });

  describe('create', () => {
    it('should create a service for the authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const dto = {
        name: 'Corte Tradicional',
        description: 'Corte masculino na tesoura e máquina',
        durationMinutes: 45,
        totalPrice: 40.0,
        downPaymentPercent: 25,
        serviceGroupId: 'group-1',
      };
      const expected = { id: 'service-1', ...dto, companyId: 'company-1' };
      mockCompanyServiceService.createService.mockResolvedValue(expected);

      const result = await controller.create(dto as any, req);
      expect(service.createService).toHaveBeenCalledWith(dto, 'owner-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getServicesByCompany', () => {
    it('should list services of the company for the logged owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = [{ id: 'service-1', name: 'Corte Tradicional' }];
      mockCompanyServiceService.getServicesByCompany.mockResolvedValue(
        expected,
      );

      const result = await controller.getServicesByCompany(req, undefined);
      expect(service.getServicesByCompany).toHaveBeenCalledWith(
        'owner-1',
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getServicesBySlug', () => {
    it('should return public service catalog for a company slug', async () => {
      const expected = [{ id: 'service-1', name: 'Corte Tradicional' }];
      mockCompanyServiceService.getServicesBySlug.mockResolvedValue(expected);

      const result = await controller.getServicesBySlug('barbearia-vip');
      expect(service.getServicesBySlug).toHaveBeenCalledWith('barbearia-vip');
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should update service details', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const updateDto = { name: 'Corte Degradê Premium' };
      const expected = { id: 'service-1', name: 'Corte Degradê Premium' };
      mockCompanyServiceService.updateService.mockResolvedValue(expected);

      const result = await controller.update(
        'service-1',
        updateDto as any,
        req,
      );
      expect(service.updateService).toHaveBeenCalledWith(
        'owner-1',
        'service-1',
        updateDto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateService', () => {
    it('should deactivate service', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = { id: 'service-1', isActive: false };
      mockCompanyServiceService.deactivateService.mockResolvedValue(expected);

      const result = await controller.deactivateService('service-1', req);
      expect(service.deactivateService).toHaveBeenCalledWith(
        'owner-1',
        'service-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('activateService', () => {
    it('should activate service', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = { id: 'service-1', isActive: true };
      mockCompanyServiceService.activateService.mockResolvedValue(expected);

      const result = await controller.activateService('service-1', req);
      expect(service.activateService).toHaveBeenCalledWith(
        'owner-1',
        'service-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getAllServices', () => {
    it('should return all services for system managers', async () => {
      const expected = [{ id: 'service-1', name: 'Corte Tradicional' }];
      mockCompanyServiceService.getAllServices.mockResolvedValue(expected);

      const result = await controller.getAllServices();
      expect(service.getAllServices).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });
});
