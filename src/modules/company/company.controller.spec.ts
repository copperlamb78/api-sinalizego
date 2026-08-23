import { Test, TestingModule } from '@nestjs/testing';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

describe('CompanyController', () => {
  let controller: CompanyController;
  let companyService: CompanyService;

  const mockCompanyService = {
    createCompanyWithUser: jest.fn(),
    createCompany: jest.fn(),
    getCompanyByUserId: jest.fn(),
    getCompanyByCompanyId: jest.fn(),
    getAllCompaniesByUserId: jest.fn(),
    getAllCompanies: jest.fn(),
    findBySlug: jest.fn(),
    getCompanyBySlug: jest.fn(),
    getDashboardMetrics: jest.fn(),
    getCompanyBalance: jest.fn(),
    requestInstantWithdrawal: jest.fn(),
    getCompanyWithdrawalHistory: jest.fn(),
    updateCompany: jest.fn(),
    deactivateCompany: jest.fn(),
    activateCompany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyController],
      providers: [
        {
          provide: CompanyService,
          useValue: mockCompanyService,
        },
      ],
    }).compile();

    controller = module.get<CompanyController>(CompanyController);
    companyService = module.get<CompanyService>(CompanyService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCompany', () => {
    it('should create company along with new user', async () => {
      const dto = {
        name: 'Dono Barbearia',
        email: 'dono@barber.com',
        phone: '75999998888',
        password: 'password123',
        businessName: 'Barbearia VIP',
        providerType: 'Barbearia',
        district: 'Centro',
        street: 'Rua Principal',
        city: 'Feira de Santana',
        state: 'BA',
        zipCode: '44000000',
        number: '100',
      };
      const expected = { message: 'Empresa criada com sucesso' };
      mockCompanyService.createCompanyWithUser.mockResolvedValue(expected);

      const result = await controller.createCompany(dto as any);
      expect(companyService.createCompanyWithUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('createCompanyToUser', () => {
    it('should create company for authenticated existing user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = {
        businessName: 'Barbearia VIP',
        providerType: 'Barbearia',
        district: 'Centro',
        street: 'Rua Principal',
        city: 'Feira de Santana',
        state: 'BA',
        zipCode: '44000000',
        number: '100',
      };
      const expected = { id: 'company-1', ...dto, userId: 'user-1' };
      mockCompanyService.createCompany.mockResolvedValue(expected);

      const result = await controller.createCompanyToUser(dto as any, req);
      expect(companyService.createCompany).toHaveBeenCalledWith(dto, 'user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('findBySlug', () => {
    it('should return public company storefront data by slug', async () => {
      const expected = {
        id: 'company-1',
        businessName: 'Barbearia VIP',
        slug: 'barbearia-vip',
        workingHours: [],
        serviceGroups: [],
      };
      mockCompanyService.findBySlug.mockResolvedValue(expected);

      const result = await controller.findBySlug('barbearia-vip');
      expect(companyService.findBySlug).toHaveBeenCalledWith('barbearia-vip');
      expect(result).toEqual(expected);
    });
  });

  describe('getCompanyBySlug', () => {
    it('should return public company data by slug', async () => {
      const expected = {
        id: 'company-1',
        businessName: 'Barbearia VIP',
        slug: 'barbearia-vip',
      };
      mockCompanyService.findBySlug.mockResolvedValue(expected);

      const result = await controller.getCompanyBySlug('barbearia-vip');
      expect(companyService.findBySlug).toHaveBeenCalledWith('barbearia-vip');
      expect(result).toEqual(expected);
    });
  });

  describe('getCompanyById', () => {
    it('should return company by companyId', async () => {
      const expected = { id: 'company-1', businessName: 'Barbearia VIP' };
      mockCompanyService.getCompanyByCompanyId.mockResolvedValue(expected);

      const result = await controller.getCompanyById('company-1');
      expect(companyService.getCompanyByCompanyId).toHaveBeenCalledWith(
        'company-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getCompanyByUserId', () => {
    it('should return company for the authenticated user from req.user.sub', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'company-1', businessName: 'Barbearia VIP' };
      mockCompanyService.getCompanyByUserId.mockResolvedValue(expected);

      const result = await controller.getCompanyByUserId(req);
      expect(companyService.getCompanyByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getAllCompaniesByUserId', () => {
    it('should return companies for authenticated user', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = [{ id: 'company-1', businessName: 'Barbearia VIP' }];
      mockCompanyService.getAllCompaniesByUserId.mockResolvedValue(expected);

      const result = await controller.getAllCompaniesByUserId(req);
      expect(companyService.getAllCompaniesByUserId).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('updateCompany', () => {
    it('should update company data', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const updateDto = { businessName: 'Barbearia VIP Premium' };
      const expected = {
        id: 'company-1',
        businessName: 'Barbearia VIP Premium',
      };
      mockCompanyService.updateCompany.mockResolvedValue(expected);

      const result = await controller.updateCompany(
        'company-1',
        updateDto as any,
        req,
      );
      expect(companyService.updateCompany).toHaveBeenCalledWith(
        'user-1',
        'company-1',
        updateDto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateCompany', () => {
    it('should deactivate company', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'company-1', isActive: false };
      mockCompanyService.deactivateCompany.mockResolvedValue(expected);

      const result = await controller.deactivateCompany('company-1', req);
      expect(companyService.deactivateCompany).toHaveBeenCalledWith(
        'user-1',
        'company-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('activateCompany', () => {
    it('should activate company', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = { id: 'company-1', isActive: true };
      mockCompanyService.activateCompany.mockResolvedValue(expected);

      const result = await controller.activateCompany('company-1', req);
      expect(companyService.activateCompany).toHaveBeenCalledWith(
        'user-1',
        'company-1',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics for authenticated owner', async () => {
      const req = {
        user: { sub: 'user-1', role: 'COMPANY_OWNER' },
      } as any;
      const dto = { startDate: '2026-08-01', endDate: '2026-08-23' };
      const expected = {
        company: {
          id: 'comp-1',
          businessName: 'Barbearia VIP',
          slug: 'barbearia-vip',
        },
        financial: {
          totalRevenue: 1000,
          totalDownPaymentCollected: 500,
          totalPlatformFees: 50,
          netIncome: 950,
        },
        volume: {
          total: 10,
          completed: 8,
          confirmed: 2,
          canceled: 0,
          pendingPayment: 0,
          completionRate: 80,
        },
        topServices: [],
        upcomingToday: [],
      };
      mockCompanyService.getDashboardMetrics.mockResolvedValue(expected);

      const result = await controller.getDashboardMetrics(req, dto as any);

      expect(companyService.getDashboardMetrics).toHaveBeenCalledWith(
        'user-1',
        'COMPANY_OWNER',
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getBalance', () => {
    it('should return company balance and escrow hold metrics for authenticated owner', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = {
        companyId: 'comp-1',
        businessName: 'Barbearia VIP',
        walletId: 'wal_123',
        availableBalance: 245.0,
        escrowLockedBalance: 120.0,
        completedNetRevenue: 745.0,
        totalWithdrawn: 500.0,
        nextFreeWithdrawalDate: '2026-08-31T06:00:00.000Z',
        instantTransferFee: 5.0,
      };
      mockCompanyService.getCompanyBalance.mockResolvedValue(expected);

      const result = await controller.getBalance(req);

      expect(companyService.getCompanyBalance).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('requestWithdrawal', () => {
    it('should request instant withdrawal for authenticated owner', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const dto = { amount: 100.0 };
      const expected = {
        message: 'Saque avulso solicitado com sucesso.',
        withdrawal: {
          id: 'tx-1',
          requestedAmount: 100.0,
          transferFee: 5.0,
          netAmountTransferred: 95.0,
          status: 'CONFIRMED',
          transferredAt: new Date(),
          remainingAvailableBalance: 145.0,
          escrowLockedBalance: 120.0,
        },
      };
      mockCompanyService.requestInstantWithdrawal.mockResolvedValue(expected);

      const result = await controller.requestWithdrawal(req, dto as any);

      expect(companyService.requestInstantWithdrawal).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getWithdrawals', () => {
    it('should return withdrawal history for authenticated owner', async () => {
      const req = { user: { sub: 'user-1' } } as any;
      const expected = [
        {
          id: 'tx-1',
          requestedAmount: 100.0,
          transferFee: 5.0,
          netAmountTransferred: 95.0,
          status: 'CONFIRMED',
          isFreeWeekly: false,
          asaasTransferId: 'tra_123',
          transferredAt: new Date(),
        },
      ];
      mockCompanyService.getCompanyWithdrawalHistory.mockResolvedValue(expected);

      const result = await controller.getWithdrawals(req);

      expect(
        companyService.getCompanyWithdrawalHistory,
      ).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });
});


