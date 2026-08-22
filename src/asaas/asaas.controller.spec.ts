import { Test, TestingModule } from '@nestjs/testing';
import { AsaasController } from './asaas.controller';
import { AsaasService } from './asaas.service';

describe('AsaasController', () => {
  let controller: AsaasController;
  let service: AsaasService;

  const mockAsaasService = {
    listAllSubAccounts: jest.fn(),
    listSubAccountById: jest.fn(),
    getSubacccountBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AsaasController],
      providers: [
        {
          provide: AsaasService,
          useValue: mockAsaasService,
        },
      ],
    }).compile();

    controller = module.get<AsaasController>(AsaasController);
    service = module.get<AsaasService>(AsaasService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listAccounts', () => {
    it('should call asaasService.listAllSubAccounts', async () => {
      const expected = [{ id: 'sub_123', name: 'Barbearia VIP' }];
      mockAsaasService.listAllSubAccounts.mockResolvedValue(expected);

      const result = await controller.listAccounts();
      expect(service.listAllSubAccounts).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('getAccountById', () => {
    it('should call asaasService.listSubAccountById with passed id param', async () => {
      const expected = { id: 'sub_123', name: 'Barbearia VIP' };
      mockAsaasService.listSubAccountById.mockResolvedValue(expected);

      const result = await controller.getAccountById('sub_123');
      expect(service.listSubAccountById).toHaveBeenCalledWith('sub_123');
      expect(result).toEqual(expected);
    });
  });

  describe('getSubaccountBalance', () => {
    it('should call asaasService.getSubacccountBalance with walletId and authenticated userId', async () => {
      const req = { user: { sub: 'admin-user-1' } } as any;
      const expected = { balance: 1500.5 };
      mockAsaasService.getSubacccountBalance.mockResolvedValue(expected);

      const result = await controller.getSubaccountBalance('wal_123456', req);
      expect(service.getSubacccountBalance).toHaveBeenCalledWith(
        'wal_123456',
        'admin-user-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
