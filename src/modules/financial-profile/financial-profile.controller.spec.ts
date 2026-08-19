import { Test, TestingModule } from '@nestjs/testing';
import { FinancialProfileController } from './financial-profile.controller';
import { FinancialProfileService } from './financial-profile.service';

describe('FinancialProfileController', () => {
  let controller: FinancialProfileController;
  let service: FinancialProfileService;

  const mockFinancialProfileService = {
    createFinancialProfile: jest.fn(),
    getAllFinancialProfilesByUserId: jest.fn(),
    getAllFinancialProfiles: jest.fn(),
    getFinancialProfileByUserId: jest.fn(),
    getFinancialProfileById: jest.fn(),
    deactivateFinancialProfile: jest.fn(),
    activateFinancialProfile: jest.fn(),
    getFinancialProfileBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialProfileController],
      providers: [
        {
          provide: FinancialProfileService,
          useValue: mockFinancialProfileService,
        },
      ],
    }).compile();

    controller = module.get<FinancialProfileController>(FinancialProfileController);
    service = module.get<FinancialProfileService>(FinancialProfileService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create financial subaccount on Asaas for logged user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = {
        name: 'Barbearia VIP LTDA',
        email: 'financeiro@barber.com',
        cpfCnpj: '12345678000195',
        companyType: 'MEI',
        mobilePhone: '75999998888',
        incomeValue: 5000,
        address: 'Av Getulio Vargas',
        addressNumber: '100',
        province: 'Centro',
        postalCode: '44000000',
      };
      const expected = { id: 'fp-1', ...dto, userId: 'user-1' };
      mockFinancialProfileService.createFinancialProfile.mockResolvedValue(expected);

      const result = await controller.create(dto as any, req);
      expect(service.createFinancialProfile).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getAllByUserId', () => {
    it('should list financial profiles of the logged user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = [{ id: 'fp-1', walletId: 'wallet-1' }];
      mockFinancialProfileService.getAllFinancialProfilesByUserId.mockResolvedValue(expected);

      const result = await controller.getAllByUserId(req, undefined);
      expect(service.getAllFinancialProfilesByUserId).toHaveBeenCalledWith('user-1', undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('getAllProfiles', () => {
    it('should list all financial profiles for admin', async () => {
      const expected = [{ id: 'fp-1', name: 'Barbearia VIP' }];
      mockFinancialProfileService.getAllFinancialProfiles.mockResolvedValue(expected);

      const result = await controller.getAllProfiles(undefined);
      expect(service.getAllFinancialProfiles).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('getByUserId', () => {
    it('should return specific financial profile of the logged user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'fp-1', name: 'Barbearia VIP' };
      mockFinancialProfileService.getFinancialProfileByUserId.mockResolvedValue(expected);

      const result = await controller.getByUserId(req, 'fp-1');
      expect(service.getFinancialProfileByUserId).toHaveBeenCalledWith('user-1', 'fp-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getById', () => {
    it('should return sanitized financial profile by ID', async () => {
      const expected = { id: 'fp-1', name: 'Barbearia VIP' };
      mockFinancialProfileService.getFinancialProfileById.mockResolvedValue(expected);

      const result = await controller.getById('fp-1');
      expect(service.getFinancialProfileById).toHaveBeenCalledWith('fp-1');
      expect(result).toEqual(expected);
    });
  });

  describe('deactivate', () => {
    it('should deactivate financial profile', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'fp-1', isActive: false };
      mockFinancialProfileService.deactivateFinancialProfile.mockResolvedValue(expected);

      const result = await controller.deactivate('fp-1', req);
      expect(service.deactivateFinancialProfile).toHaveBeenCalledWith('fp-1', 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('activate', () => {
    it('should activate financial profile', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'fp-1', isActive: true };
      mockFinancialProfileService.activateFinancialProfile.mockResolvedValue(expected);

      const result = await controller.activate('fp-1', req);
      expect(service.activateFinancialProfile).toHaveBeenCalledWith('fp-1', 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getFinancialProfileBalance', () => {
    it('should return balance from Asaas subaccount', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { balance: 1500.50 };
      mockFinancialProfileService.getFinancialProfileBalance.mockResolvedValue(expected);

      const result = await controller.getFinancialProfileBalance('fp-1', req);
      expect(service.getFinancialProfileBalance).toHaveBeenCalledWith('fp-1', 'user-1');
      expect(result).toEqual(expected);
    });
  });
});
