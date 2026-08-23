import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    getDashboardMetrics: jest.fn(),
    listCompanies: jest.fn(),
    toggleCompanyStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should return global platform metrics', async () => {
      const dto = { startDate: '2026-08-01', endDate: '2026-08-31' };
      const expected = {
        period: {
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-31T23:59:59.999Z',
        },
        financial: {
          platformGrossRevenue: 1000,
          totalAsaasPixCosts: 50,
          platformNetProfit: 950,
          gmv: 10000,
        },
        growth: {
          users: { total: 100, clients: 80, owners: 20 },
          companies: { total: 20, active: 19, inactive: 1 },
          appointments: {
            total: 200,
            completed: 150,
            confirmed: 30,
            canceled: 15,
            pendingPayment: 5,
          },
        },
        topTenants: [],
      };
      mockAdminService.getDashboardMetrics.mockResolvedValue(expected);

      const result = await controller.getDashboardMetrics(dto);

      expect(service.getDashboardMetrics).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('listCompanies', () => {
    it('should return paginated list of companies', async () => {
      const query = { page: 1, limit: 10, search: 'Barber' };
      const expected = {
        data: [{ id: 'comp-1', businessName: 'Barbearia VIP' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockAdminService.listCompanies.mockResolvedValue(expected);

      const result = await controller.listCompanies(query as any);

      expect(service.listCompanies).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('toggleCompanyStatus', () => {
    it('should toggle company status by id', async () => {
      const expected = {
        message: 'Estabelecimento suspenso com sucesso.',
        company: { id: 'comp-1', isActive: false },
      };
      mockAdminService.toggleCompanyStatus.mockResolvedValue(expected);

      const result = await controller.toggleCompanyStatus('comp-1');

      expect(service.toggleCompanyStatus).toHaveBeenCalledWith('comp-1');
      expect(result).toEqual(expected);
    });
  });
});
