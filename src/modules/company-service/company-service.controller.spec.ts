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
    const validUUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    it('should fail validation when downPaymentPercent is not 30 or 50 (e.g. 25% or 40%)', async () => {
      const dto = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 50,
        downPaymentPercent: 25,
        serviceGroupId: validUUID,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err) => err.property === 'downPaymentPercent')).toBe(
        true,
      );
    });

    it('should fail validation when serviceGroupId is not a valid UUID', async () => {
      const dto = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 50,
        downPaymentPercent: 50,
        serviceGroupId: 'invalid-non-uuid-string',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err) => err.property === 'serviceGroupId')).toBe(
        true,
      );
    });

    it('should pass validation when downPaymentPercent is 30 or 50 and serviceGroupId is a valid UUID', async () => {
      const dto30 = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 500,
        downPaymentPercent: 30,
        serviceGroupId: validUUID,
      });
      const errors30 = await validate(dto30);
      expect(errors30.length).toBe(0);

      const dto50 = plainToInstance(CreateServiceDto, {
        name: 'Corte',
        durationMinutes: 30,
        totalPrice: 50,
        downPaymentPercent: 50,
        serviceGroupId: validUUID,
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
        downPaymentPercent: 50,
        serviceGroupId: 'group-1',
      };
      const expected = { id: 'service-1', ...dto, companyId: 'company-1' };
      mockCompanyServiceService.createService.mockResolvedValue(expected);

      const result = await controller.create(dto as any, req);

      expect(mockCompanyServiceService.createService).toHaveBeenCalledWith(
        dto,
        'owner-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getServicesBySlug', () => {
    it('should return services for valid slug', async () => {
      const expected = [{ id: 'service-1', name: 'Corte' }];
      mockCompanyServiceService.getServicesBySlug.mockResolvedValue(expected);

      const result = await controller.getServicesBySlug('minha-barbearia');

      expect(mockCompanyServiceService.getServicesBySlug).toHaveBeenCalledWith(
        'minha-barbearia',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should update service for the authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const dto = { name: 'Corte Atualizado' };
      const expected = { id: 'service-1', name: 'Corte Atualizado' };
      mockCompanyServiceService.updateService.mockResolvedValue(expected);

      const result = await controller.update('service-1', dto as any, req);

      expect(mockCompanyServiceService.updateService).toHaveBeenCalledWith(
        'owner-1',
        'service-1',
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateService', () => {
    it('should deactivate service for the authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = { id: 'service-1', isActive: false };
      mockCompanyServiceService.deactivateService.mockResolvedValue(expected);

      const result = await controller.deactivateService('service-1', req);

      expect(mockCompanyServiceService.deactivateService).toHaveBeenCalledWith(
        'owner-1',
        'service-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('activateService', () => {
    it('should activate service for the authenticated owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = { id: 'service-1', isActive: true };
      mockCompanyServiceService.activateService.mockResolvedValue(expected);

      const result = await controller.activateService('service-1', req);

      expect(mockCompanyServiceService.activateService).toHaveBeenCalledWith(
        'owner-1',
        'service-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getServicesByCompany', () => {
    it('should return services for the authenticated owner company', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = [{ id: 'service-1' }];
      mockCompanyServiceService.getServicesByCompany.mockResolvedValue(
        expected,
      );

      const result = await controller.getServicesByCompany(req);

      expect(
        mockCompanyServiceService.getServicesByCompany,
      ).toHaveBeenCalledWith('owner-1', undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('getAllServices', () => {
    it('should return all services (Admin)', async () => {
      const expected = [{ id: 'service-1' }];
      mockCompanyServiceService.getAllServices.mockResolvedValue(expected);

      const result = await controller.getAllServices();

      expect(mockCompanyServiceService.getAllServices).toHaveBeenCalledWith(
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });
});
