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
    it('should create a service group with capacity and companyId', async () => {
      const dto = {
        name: 'Cabeleireiros',
        capacity: 3,
        companyId: 'company-1',
      };
      const expected = { id: 'group-1', ...dto };
      mockServiceGroupService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return list of service groups', async () => {
      const expected = [{ id: 'group-1', name: 'Cabeleireiros', capacity: 3 }];
      mockServiceGroupService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(undefined);
      expect(service.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('findAllByCompanyId', () => {
    it('should return list of service groups for a specific company', async () => {
      const expected = [{ id: 'group-1', name: 'Cabeleireiros', capacity: 3, companyId: 'company-1' }];
      mockServiceGroupService.findAllByCompanyId.mockResolvedValue(expected);

      const result = await controller.findAllByCompanyId('company-1', undefined);
      expect(service.findAllByCompanyId).toHaveBeenCalledWith('company-1', undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should return service group by ID', async () => {
      const expected = { id: 'group-1', name: 'Cabeleireiros', capacity: 3 };
      mockServiceGroupService.findOneById.mockResolvedValue(expected);

      const result = await controller.findOne('group-1');
      expect(service.findOneById).toHaveBeenCalledWith('group-1');
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('should update service group details', async () => {
      const updateDto = { name: 'Cabeleireiros & Barbeiros', capacity: 4 };
      const expected = { id: 'group-1', ...updateDto };
      mockServiceGroupService.update.mockResolvedValue(expected);

      const result = await controller.update('group-1', updateDto);
      expect(service.update).toHaveBeenCalledWith('group-1', updateDto);
      expect(result).toEqual(expected);
    });
  });

  describe('updateByCompanyId', () => {
    it('should update service group verifying companyId', async () => {
      const updateDto = { capacity: 5 };
      const expected = { id: 'group-1', companyId: 'company-1', capacity: 5 };
      mockServiceGroupService.updateByCompanyId.mockResolvedValue(expected);

      const result = await controller.updateByCompanyId('group-1', 'company-1', updateDto);
      expect(service.updateByCompanyId).toHaveBeenCalledWith('group-1', 'company-1', updateDto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('should delete service group by string ID', async () => {
      const expected = { id: 'group-1', name: 'Cabeleireiros' };
      mockServiceGroupService.remove.mockResolvedValue(expected);

      const result = await controller.remove('group-1');
      expect(service.remove).toHaveBeenCalledWith('group-1');
      expect(result).toEqual(expected);
    });
  });
});
