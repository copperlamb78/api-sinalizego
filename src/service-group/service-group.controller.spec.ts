import { Test, TestingModule } from '@nestjs/testing';
import { ServiceGroupController } from './service-group.controller';
import { ServiceGroupService } from './service-group.service';

describe('ServiceGroupController', () => {
  let controller: ServiceGroupController;
  let service: ServiceGroupService;

  const mockServiceGroupService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findAllByCompanyId: jest.fn(),
    findOneById: jest.fn(),
    update: jest.fn(),
    updateByCompanyId: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceGroupController],
      providers: [
        {
          provide: ServiceGroupService,
          useValue: mockServiceGroupService,
        },
      ],
    }).compile();

    controller = module.get<ServiceGroupController>(ServiceGroupController);
    service = module.get<ServiceGroupService>(ServiceGroupService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a service group for the authenticated user company', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const dto = {
        name: 'Cabeleireiros',
        capacity: 3,
        companyId: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
      };
      const expected = { id: 'group-1', ...dto };
      mockServiceGroupService.create.mockResolvedValue(expected);

      const result = await controller.create(dto, req);
      expect(service.create).toHaveBeenCalledWith(dto, 'owner-1');
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return list of service groups passing authenticated user info', async () => {
      const req = { user: { sub: 'owner-1', role: 'COMPANY_OWNER' } } as any;
      const expected = [{ id: 'group-1', name: 'Cabeleireiros', capacity: 3 }];
      mockServiceGroupService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(req, undefined);
      expect(service.findAll).toHaveBeenCalledWith(
        'owner-1',
        'COMPANY_OWNER',
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('findAllByCompanyId', () => {
    it('should return list of service groups for a specific company if owner', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = [
        {
          id: 'group-1',
          name: 'Cabeleireiros',
          capacity: 3,
          companyId: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        },
      ];
      mockServiceGroupService.findAllByCompanyId.mockResolvedValue(expected);

      const result = await controller.findAllByCompanyId(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        req,
        undefined,
      );
      expect(service.findAllByCompanyId).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should return service group by ID passing authenticated user info', async () => {
      const req = { user: { sub: 'owner-1', role: 'COMPANY_OWNER' } } as any;
      const expected = {
        id: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        name: 'Cabeleireiros',
        capacity: 3,
      };
      mockServiceGroupService.findOneById.mockResolvedValue(expected);

      const result = await controller.findOne(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        req,
      );
      expect(service.findOneById).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
        'COMPANY_OWNER',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should update service group details with user auth check', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const updateDto = { name: 'Cabeleireiros & Barbeiros', capacity: 4 };
      const expected = {
        id: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        ...updateDto,
      };
      mockServiceGroupService.update.mockResolvedValue(expected);

      const result = await controller.update(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        updateDto,
        req,
      );
      expect(service.update).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
        updateDto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('updateByCompanyId', () => {
    it('should update service group verifying companyId and user auth', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const updateDto = { capacity: 5 };
      const expected = {
        id: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        companyId: 'f1e2d3c4-b5a6-0987-6543-210fedcba988',
        capacity: 5,
      };
      mockServiceGroupService.updateByCompanyId.mockResolvedValue(expected);

      const result = await controller.updateByCompanyId(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'f1e2d3c4-b5a6-0987-6543-210fedcba988',
        updateDto,
        req,
      );
      expect(service.updateByCompanyId).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'f1e2d3c4-b5a6-0987-6543-210fedcba988',
        'owner-1',
        updateDto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('should deactivate service group with user auth check', async () => {
      const req = { user: { sub: 'owner-1' } } as any;
      const expected = {
        id: 'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        name: 'Cabeleireiros',
        isActive: false,
      };
      mockServiceGroupService.remove.mockResolvedValue(expected);

      const result = await controller.remove(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        req,
      );
      expect(service.remove).toHaveBeenCalledWith(
        'f1e2d3c4-b5a6-0987-6543-210fedcba987',
        'owner-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
