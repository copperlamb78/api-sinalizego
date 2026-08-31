import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApptStatus, Role, TransactionStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrisma = {
    appointment: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    company: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should throw BadRequestException if startDate is after endDate', async () => {
      await expect(
        service.getDashboardMetrics({
          startDate: '2026-08-30',
          endDate: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate global metrics, SaaS revenue, Asaas costs, GMV and top tenants', async () => {
      mockPrisma.appointment.groupBy
        .mockResolvedValueOnce([
          { status: ApptStatus.COMPLETED, _count: { _all: 1 } },
          { status: ApptStatus.CONFIRMED, _count: { _all: 1 } },
          { status: ApptStatus.CANCELED, _count: { _all: 1 } },
          { status: ApptStatus.PENDING_PAYMENT, _count: { _all: 1 } },
        ]) // statusGroup
        .mockResolvedValueOnce([
          {
            companyId: 'comp-1',
            _count: { _all: 2 },
            _sum: {
              servicePrice: '100.00',
              downPaymentAmount: '0.00',
              platformFeeAmount: '5.00',
            },
          },
          {
            companyId: 'comp-2',
            _count: { _all: 2 },
            _sum: {
              servicePrice: '0.00',
              downPaymentAmount: '40.00',
              platformFeeAmount: '4.00',
            },
          },
        ]); // topTenantsGroupBy

      mockPrisma.appointment.aggregate
        .mockResolvedValueOnce({
          _sum: { servicePrice: '100.00', platformFeeAmount: '5.00' },
        }) // completedAgg
        .mockResolvedValueOnce({
          _sum: { downPaymentAmount: '40.00', platformFeeAmount: '4.00' },
        }) // confirmedAgg
        .mockResolvedValueOnce({
          _sum: {
            servicePrice: '0.00',
            downPaymentAmount: '0.00',
            retainedDepositAmount: '0.00',
            platformFeeAmount: '0.00',
          },
        }) // noShowAgg
        .mockResolvedValueOnce({
          _sum: { servicePrice: '50.00', retainedDepositAmount: '0.00' },
        }); // canceledAgg

      const mockTransactionsAgg = {
        _sum: {
          asaasFee: '1.98',
          platformAbsorbedFee: '0.00',
        },
      };
      mockPrisma.transaction.aggregate.mockResolvedValue(mockTransactionsAgg);

      mockPrisma.company.findMany.mockResolvedValue([
        {
          id: 'comp-1',
          businessName: 'Barbearia VIP',
          slug: 'barbearia-vip',
        },
        {
          id: 'comp-2',
          businessName: 'Studio Beleza',
          slug: 'studio-beleza',
        },
      ]);

      // Counts mocks
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(85) // clients
        .mockResolvedValueOnce(15); // owners

      mockPrisma.company.count
        .mockResolvedValueOnce(15) // totalCompanies
        .mockResolvedValueOnce(14) // active
        .mockResolvedValueOnce(1); // inactive

      const result = await service.getDashboardMetrics({
        startDate: '2026-08-01',
        endDate: '2026-08-23',
      });

      // Platform Gross Revenue: 5.00 + 4.00 = 9.00
      expect(result.financial.platformGrossRevenue).toBe(9.0);
      // Platform Absorbed Gateway Costs: 0.00 (Regra N2 / A10)
      expect(result.financial.totalAsaasPixCosts).toBe(0.0);
      // Net Profit: 9.00 - 0.00 = 9.00
      expect(result.financial.platformNetProfit).toBe(9.0);
      // GMV: 100.00 (COMPLETED) + 40.00 (CONFIRMED) = 140.00
      expect(result.financial.gmv).toBe(140.0);

      // Growth
      expect(result.growth.users.total).toBe(100);
      expect(result.growth.users.clients).toBe(85);
      expect(result.growth.users.owners).toBe(15);
      expect(result.growth.companies.total).toBe(15);
      expect(result.growth.companies.active).toBe(14);
      expect(result.growth.companies.inactive).toBe(1);

      // Appointments
      expect(result.growth.appointments.total).toBe(4);
      expect(result.growth.appointments.completed).toBe(1);
      expect(result.growth.appointments.confirmed).toBe(1);
      expect(result.growth.appointments.canceled).toBe(1);
      expect(result.growth.appointments.pendingPayment).toBe(1);

      // Pre-populated appointmentsByStatus
      expect(result.growth.appointments.byStatus.COMPLETED).toBe(1);
      expect(result.growth.appointments.byStatus.CONFIRMED).toBe(1);
      expect(result.growth.appointments.byStatus.CANCELED).toBe(1);
      expect(result.growth.appointments.byStatus.PENDING_PAYMENT).toBe(1);
      expect(result.growth.appointments.byStatus.PENDING).toBe(1);
      expect(result.growth.appointments.byStatus.CANCELLED_BY_CLIENT).toBe(0);
      expect(result.growth.appointments.byStatus.CANCELLED_BY_COMPANY).toBe(0);
      expect(result.growth.appointments.byStatus.NO_SHOW).toBe(0);
      expect(result.appointmentsByStatus.COMPLETED).toBe(1);

      // Loss Prevented Metrics
      expect(result.lossPrevented).toBeDefined();
      expect(result.lossPrevented.totalLossPrevented).toBe(0);
      expect(result.lossPrevented.retainedAppointmentsCount).toBe(0);

      // Top Tenants
      expect(result.topTenants).toHaveLength(2);
      expect(result.topTenants[0].businessName).toBe('Barbearia VIP');
      expect(result.topTenants[0].platformFeeGenerated).toBe(5.0);
      expect(result.topTenants[0].totalRevenue).toBe(100.0);
    });

    it('should fallback to default asaas fee calculation if no confirmed transactions exist', async () => {
      mockPrisma.appointment.groupBy
        .mockResolvedValueOnce([
          { status: ApptStatus.COMPLETED, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([]); // topTenants

      mockPrisma.appointment.aggregate
        .mockResolvedValueOnce({
          _sum: { servicePrice: '50.00', platformFeeAmount: '2.50' },
        }) // completedAgg
        .mockResolvedValueOnce({
          _sum: { downPaymentAmount: '0.00', platformFeeAmount: '0.00' },
        }) // confirmedAgg
        .mockResolvedValueOnce({
          _sum: {
            servicePrice: '0.00',
            downPaymentAmount: '0.00',
            retainedDepositAmount: '0.00',
            platformFeeAmount: '0.00',
          },
        }) // noShowAgg
        .mockResolvedValueOnce({
          _sum: { servicePrice: '0.00', retainedDepositAmount: '0.00' },
        }); // canceledAgg

      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { asaasFee: null },
      });

      mockPrisma.company.findMany.mockResolvedValue([]);

      mockPrisma.user.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2);

      mockPrisma.company.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);

      const result = await service.getDashboardMetrics();

      expect(result.financial.platformGrossRevenue).toBe(2.5);
      expect(result.financial.totalAsaasPixCosts).toBe(0.0);
      expect(result.financial.platformNetProfit).toBe(2.5);
    });
  });

  describe('listCompanies', () => {
    it('should return paginated list of companies with default pagination', async () => {
      const mockCompanies = [
        {
          id: 'comp-1',
          businessName: 'Barbearia VIP',
          slug: 'barbearia-vip',
          isActive: true,
          owner: {
            id: 'user-1',
            name: 'Carlos',
            email: 'carlos@barber.com',
            phone: '75999999999',
          },
          _count: { appointments: 50, services: 10, serviceGroups: 2 },
        },
      ];

      mockPrisma.company.findMany.mockResolvedValue(mockCompanies);
      mockPrisma.company.count.mockResolvedValue(1);

      const result = await service.listCompanies();

      expect(result.data).toEqual(mockCompanies);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter companies by search query and active status', async () => {
      mockPrisma.company.findMany.mockResolvedValue([]);
      mockPrisma.company.count.mockResolvedValue(0);

      const result = await service.listCompanies({
        page: 2,
        limit: 5,
        search: 'Centro',
        status: 'ACTIVE',
      });

      expect(result.meta).toEqual({
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 1,
      });
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          where: expect.objectContaining({
            isActive: true,
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('toggleCompanyStatus', () => {
    it('should throw NotFoundException if company is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.toggleCompanyStatus('comp-invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should suspend an active company and set disabledAt', async () => {
      const existingCompany = {
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        slug: 'barbearia-vip',
        isActive: true,
        disabledAt: null,
      };
      mockPrisma.company.findUnique.mockResolvedValue(existingCompany);
      mockPrisma.company.update.mockResolvedValue({
        ...existingCompany,
        isActive: false,
        disabledAt: new Date(),
      });

      const result = await service.toggleCompanyStatus('comp-1');

      expect(result.message).toBe('Estabelecimento suspenso com sucesso.');
      expect(result.company.isActive).toBe(false);
      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comp-1' },
          data: {
            isActive: false,
            disabledAt: expect.any(Date),
          },
        }),
      );
    });

    it('should reactivate a suspended company and set disabledAt to null', async () => {
      const suspendedCompany = {
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        slug: 'barbearia-vip',
        isActive: false,
        disabledAt: new Date(),
      };
      mockPrisma.company.findUnique.mockResolvedValue(suspendedCompany);
      mockPrisma.company.update.mockResolvedValue({
        ...suspendedCompany,
        isActive: true,
        disabledAt: null,
      });

      const result = await service.toggleCompanyStatus('comp-1');

      expect(result.message).toBe('Estabelecimento reativado com sucesso.');
      expect(result.company.isActive).toBe(true);
      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comp-1' },
          data: {
            isActive: true,
            disabledAt: null,
          },
        }),
      );
    });
  });
});
