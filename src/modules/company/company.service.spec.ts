import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './company.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SlugHelper } from './helpers/create-slug.helper';
import { AuthService } from '../auth/auth.service';
import { AsaasService } from 'src/asaas/asaas.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  ApptStatus,
  BillingType,
  Role,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: PrismaService;
  let slugHelper: SlugHelper;
  let authService: AuthService;
  let asaasService: AsaasService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    financialProfile: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalValue: 0 } }),
      create: jest.fn().mockResolvedValue({ id: 'tx-pending-1' }),
      update: jest.fn().mockResolvedValue({ id: 'tx-pending-1' }),
    },
    $transaction: jest.fn((cb) =>
      typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
    ),
  };

  const mockSlugHelper = {
    createSlug: jest.fn().mockResolvedValue('barbearia-vip'),
  };

  const mockAuthService = {
    getTokens: jest.fn().mockResolvedValue({
      accessToken: 'access.token.owner',
      refreshToken: 'refresh.token.owner',
    }),
    updateRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
  };

  const mockAsaasService = {
    transferSubaccountBalance: jest.fn(),
    getTransferFee: jest.fn().mockResolvedValue(5.0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: SlugHelper,
          useValue: mockSlugHelper,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AsaasService,
          useValue: mockAsaasService,
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    prisma = module.get<PrismaService>(PrismaService);
    slugHelper = module.get<SlugHelper>(SlugHelper);
    authService = module.get<AuthService>(AuthService);
    asaasService = module.get<AsaasService>(AsaasService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCompanyWithUser', () => {
    const dto = {
      name: 'João Barbeiro',
      email: 'joao@barber.com',
      phone: '75999998888',
      password: 'password123',
      businessName: 'Barbearia VIP',
      providerType: 'Barbearia',
      district: 'Centro',
      street: 'Rua Central',
      city: 'Feira de Santana',
      state: 'BA',
      zipCode: '44000000',
      number: '100',
    };

    it('should throw ConflictException if email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.createCompanyWithUser(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create company and user with COMPANY_OWNER role and return auth tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const createdUser = {
        id: 'user-1',
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: 'hashed_password',
        role: 'COMPANY_OWNER',
        companies: [
          {
            id: 'company-1',
            businessName: dto.businessName,
            slug: 'barbearia-vip',
          },
        ],
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await service.createCompanyWithUser(dto as any);

      expect(mockAuthService.getTokens).toHaveBeenCalledWith(
        'user-1',
        'joao@barber.com',
        'COMPANY_OWNER',
      );
      expect(mockAuthService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'user-1',
        'refresh.token.owner',
      );
      expect(result.access_token).toBe('access.token.owner');
      expect(result.refresh_token).toBe('refresh.token.owner');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('createCompany (to existing user)', () => {
    const dto = {
      businessName: 'Barbearia VIP',
      providerType: 'Barbearia',
      district: 'Centro',
      street: 'Rua Central',
      city: 'Feira de Santana',
      state: 'BA',
      zipCode: '44000000',
      number: '100',
      phone: '75999998888',
    };

    it('should throw NotFoundException if user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCompany(dto as any, 'user-unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create company, promote user to COMPANY_OWNER and return refreshed tokens', async () => {
      const existingUser = {
        id: 'user-client-1',
        name: 'Cliente Promovido',
        email: 'cliente@test.com',
        role: 'CLIENT',
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const createdCompany = {
        id: 'company-1',
        ...dto,
        slug: 'barbearia-vip',
        userId: 'user-client-1',
      };
      mockPrisma.company.create.mockResolvedValue(createdCompany);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        role: 'COMPANY_OWNER',
      });

      const result = await service.createCompany(dto as any, 'user-client-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-client-1' },
        data: { role: 'COMPANY_OWNER' },
      });
      expect(mockAuthService.getTokens).toHaveBeenCalledWith(
        'user-client-1',
        'cliente@test.com',
        'COMPANY_OWNER',
      );
      expect(result.access_token).toBe('access.token.owner');
      expect(result.refresh_token).toBe('refresh.token.owner');
      expect(result.company).toEqual(createdCompany);
    });
  });

  describe('findBySlug', () => {
    it('should throw NotFoundException if establishment is not found by slug', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('invalid-slug')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return complete storefront data with workingHours and active serviceGroups', async () => {
      const mockStorefront = {
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        slug: 'barbearia-vip',
        providerType: 'Barbearia',
        whatsapp: '75999999999',
        chairsCount: 2,
        district: 'Centro',
        street: 'Rua Principal',
        city: 'Feira de Santana',
        state: 'BA',
        zipCode: '44000000',
        number: '100',
        logoPhoto: 'logo.png',
        bannerPhoto: 'banner.png',
        timezone: 'America/Sao_Paulo',
        createdAt: new Date(),
        workingHours: [
          {
            id: 'wh-1',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00',
            lunchStartTime: '12:00',
            lunchEndTime: '13:00',
            isClosed: false,
          },
        ],
        serviceGroups: [
          {
            id: 'sg-1',
            name: 'Cabelo',
            capacity: 2,
            services: [
              {
                id: 'srv-1',
                name: 'Corte Degradê',
                description: 'Corte moderno',
                durationMinutes: 30,
                totalPrice: 35.0,
                downPaymentPercent: 25,
              },
            ],
          },
        ],
      };

      mockPrisma.company.findUnique.mockResolvedValue(mockStorefront);

      const result = await service.findBySlug('barbearia-vip');

      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { slug: 'barbearia-vip', isActive: true },
        select: expect.objectContaining({
          id: true,
          businessName: true,
          slug: true,
          workingHours: expect.any(Object),
          serviceGroups: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockStorefront);
    });
  });

  describe('getDashboardMetrics', () => {
    const mockCompany = {
      id: 'comp-1',
      businessName: 'Barbearia VIP',
      slug: 'barbearia-vip',
    };

    it('should throw NotFoundException if establishment is not found for COMPANY_OWNER', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.getDashboardMetrics('user-owner', Role.COMPANY_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if startDate is after endDate', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);

      await expect(
        service.getDashboardMetrics('user-owner', Role.COMPANY_OWNER, {
          startDate: '2026-08-30',
          endDate: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate accurate metrics, volume, top services and upcoming appointments for owner', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);

      const mockAppointments = [
        {
          id: 'appt-1',
          status: ApptStatus.COMPLETED,
          servicePrice: '50.00',
          downPaymentAmount: '25.00',
          platformFeeAmount: '2.50',
          serviceId: 'srv-1',
          service: { id: 'srv-1', name: 'Corte Degradê' },
        },
        {
          id: 'appt-2',
          status: ApptStatus.COMPLETED,
          servicePrice: '30.00',
          downPaymentAmount: '15.00',
          platformFeeAmount: '2.00',
          serviceId: 'srv-1',
          service: { id: 'srv-1', name: 'Corte Degradê' },
        },
        {
          id: 'appt-3',
          status: ApptStatus.CONFIRMED,
          servicePrice: '60.00',
          downPaymentAmount: '30.00',
          platformFeeAmount: '3.00',
          serviceId: 'srv-2',
          service: { id: 'srv-2', name: 'Barba Terapia' },
        },
        {
          id: 'appt-4',
          status: ApptStatus.CANCELED,
          servicePrice: '40.00',
          downPaymentAmount: '20.00',
          platformFeeAmount: '2.00',
          serviceId: 'srv-1',
          service: { id: 'srv-1', name: 'Corte Degradê' },
        },
        {
          id: 'appt-5',
          status: ApptStatus.PENDING_PAYMENT,
          servicePrice: '50.00',
          downPaymentAmount: '25.00',
          platformFeeAmount: '2.50',
          serviceId: 'srv-1',
          service: { id: 'srv-1', name: 'Corte Degradê' },
        },
      ];

      const mockUpcoming = [
        {
          id: 'appt-3',
          appointmentDate: new Date('2026-08-23T15:00:00.000Z'),
          appointmentEndDate: new Date('2026-08-23T15:30:00.000Z'),
          downPaymentAmount: '30.00',
          servicePrice: '60.00',
          client: { name: 'Lucas Santos', phone: '75999991111' },
          service: { name: 'Barba Terapia', durationMinutes: 30 },
        },
      ];

      // Primeiro findMany para agendamentos do período, segundo para upcoming
      mockPrisma.appointment.findMany
        .mockResolvedValueOnce(mockAppointments)
        .mockResolvedValueOnce(mockUpcoming);

      const result = await service.getDashboardMetrics(
        'user-owner',
        Role.COMPANY_OWNER,
        {
          startDate: '2026-08-01',
          endDate: '2026-08-23',
        },
      );

      expect(result.company).toEqual(mockCompany);
      // Revenue = 50 + 30 = 80.00 (apenas COMPLETED)
      expect(result.financial.totalRevenue).toBe(80.0);
      // DownPayment = 25 + 15 + 30 = 70.00 (COMPLETED + CONFIRMED)
      expect(result.financial.totalDownPaymentCollected).toBe(70.0);
      // PlatformFees = 2.50 + 2.00 + 3.00 = 7.50 (COMPLETED + CONFIRMED)
      expect(result.financial.totalPlatformFees).toBe(7.5);
      // Net Income = 80 - 7.50 = 72.50
      expect(result.financial.netIncome).toBe(72.5);

      // Volume
      expect(result.volume.total).toBe(5);
      expect(result.volume.completed).toBe(2);
      expect(result.volume.confirmed).toBe(1);
      expect(result.volume.canceled).toBe(1);
      expect(result.volume.noShow).toBe(0);
      expect(result.volume.pendingPayment).toBe(1);
      // CompletionRate = (2 / (2 + 1 + 1 + 0)) * 100 = 50.00%
      expect(result.volume.completionRate).toBe(50.0);

      // Loss Prevented Intelligence
      expect(result.lossPrevented).toBeDefined();
      expect(result.lossPrevented.totalLossPrevented).toBe(0);
      expect(result.lossPrevented.retainedAppointmentsCount).toBe(0);

      // Top Services
      expect(result.topServices).toHaveLength(2);
      expect(result.topServices[0].serviceName).toBe('Corte Degradê');
      expect(result.topServices[0].appointmentsCount).toBe(2);
      expect(result.topServices[0].totalRevenue).toBe(80.0);

      // Upcoming Today
      expect(result.upcomingToday).toHaveLength(1);
      expect(result.upcomingToday[0].clientName).toBe('Lucas Santos');
      expect(result.upcomingToday[0].serviceName).toBe('Barba Terapia');
    });

    it('should allow ADMIN to query metrics by companyId', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getDashboardMetrics(
        'admin-user',
        Role.ADMIN,
        {
          companyId: 'comp-1',
        },
      );

      expect(mockPrisma.company.findFirst).toHaveBeenCalledWith({
        where: { id: 'comp-1', isActive: true },
        select: { id: true, businessName: true, slug: true, userId: true },
      });
      expect(result.financial.totalRevenue).toBe(0);
      expect(result.volume.total).toBe(0);
    });

    it('should throw BadRequestException if ADMIN does not provide companyId and has no own company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.getDashboardMetrics('admin-user', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCompanyByCompanyId (Tenant Scoping)', () => {
    it('should return company when requested by its owner', async () => {
      const mockCompany = {
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        userId: 'user-1',
        isActive: true,
      };
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);

      const result = await service.getCompanyByCompanyId(
        'comp-1',
        'user-1',
        'COMPANY_OWNER',
      );

      expect(mockPrisma.company.findFirst).toHaveBeenCalledWith({
        where: { id: 'comp-1', userId: 'user-1', isActive: true },
      });
      expect(result).toEqual(mockCompany);
    });

    it('should allow ADMIN to retrieve company without userId scoping', async () => {
      const mockCompany = {
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        userId: 'user-other',
        isActive: true,
      };
      mockPrisma.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getCompanyByCompanyId(
        'comp-1',
        'admin-id',
        'ADMIN',
      );

      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
      });
      expect(result).toEqual(mockCompany);
    });

    it('should throw NotFoundException if company does not belong to user', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.getCompanyByCompanyId('comp-1', 'attacker-user', 'CLIENT'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCompanyBalance (Escrow Hold & Available Balance)', () => {
    it('should calculate available balance from COMPLETED appointments and escrow balance from CONFIRMED', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        financialProfileId: 'fp-1',
      });
      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        id: 'fp-1',
        walletId: 'wal_123',
        pixAddressKey: '12345678900',
        pixAddressKeyType: 'CPF',
      });
      mockPrisma.transaction.aggregate.mockImplementation(async (args: any) => {
        if (args.where.appointment?.status === ApptStatus.COMPLETED) {
          return { _sum: { netValue: 80.0 } };
        } else if (args.where.appointment?.status === ApptStatus.CONFIRMED) {
          return { _sum: { netValue: 40.0 } };
        } else if (args.where.type === TransactionType.WITHDRAWAL) {
          return { _sum: { totalValue: 20.0 } };
        }
        return { _sum: { netValue: 0, totalValue: 0 } };
      });

      const balance = await service.getCompanyBalance('user-owner');

      expect(balance.companyId).toBe('comp-1');
      expect(balance.walletId).toBe('wal_123');
      expect(balance.completedNetRevenue).toBe(80.0);
      expect(balance.escrowLockedBalance).toBe(40.0);
      expect(balance.totalWithdrawn).toBe(20.0);
      expect(balance.availableBalance).toBe(60.0); // 80 - 20 = 60
      expect(balance.instantTransferFee).toBe(5.0);
      expect(balance.nextFreeWithdrawalDate).toBeDefined();
    });

    it('should throw NotFoundException if company does not exist', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(service.getCompanyBalance('unknown-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if financial profile or walletId is missing', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        businessName: 'Barbearia VIP',
      });
      mockPrisma.financialProfile.findFirst.mockResolvedValue(null);

      await expect(service.getCompanyBalance('user-owner')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestInstantWithdrawal (On-Demand with Fee)', () => {
    beforeEach(() => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        businessName: 'Barbearia VIP',
        financialProfileId: 'fp-1',
      });
      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        id: 'fp-1',
        walletId: 'wal_123',
        pixAddressKey: '12345678900',
        pixAddressKeyType: 'CPF',
      });
      mockPrisma.transaction.aggregate.mockImplementation(async (args: any) => {
        if (args.where.appointment?.status === ApptStatus.COMPLETED) {
          return { _sum: { netValue: 100.0 } };
        } else if (args.where.appointment?.status === ApptStatus.CONFIRMED) {
          return { _sum: { netValue: 50.0 } };
        } else if (args.where.type === TransactionType.WITHDRAWAL) {
          return { _sum: { totalValue: 0 } };
        }
        return { _sum: { netValue: 0, totalValue: 0 } };
      });
    });

    it('should throw BadRequestException if available balance is zero', async () => {
      mockPrisma.transaction.aggregate.mockImplementation(async (args: any) => {
        if (args.where.appointment?.status === ApptStatus.COMPLETED) {
          return { _sum: { netValue: 0.0 } };
        } else if (args.where.appointment?.status === ApptStatus.CONFIRMED) {
          return { _sum: { netValue: 50.0 } };
        } else if (args.where.type === TransactionType.WITHDRAWAL) {
          return { _sum: { totalValue: 0 } };
        }
        return { _sum: { netValue: 0, totalValue: 0 } };
      });

      await expect(
        service.requestInstantWithdrawal('user-owner', { amount: 20 }),
      ).rejects.toThrow(
        /Saldo disponível insuficiente para saque. Os valores de agendamentos ainda não realizados permanecem em custódia/,
      );
    });

    it('should throw BadRequestException if requested amount exceeds available balance', async () => {
      await expect(
        service.requestInstantWithdrawal('user-owner', { amount: 150 }),
      ).rejects.toThrow(/excede o saldo disponível liberado para saque/);
    });

    it('should throw BadRequestException if requested amount is <= transfer fee (R$ 5.00)', async () => {
      await expect(
        service.requestInstantWithdrawal('user-owner', { amount: 5.0 }),
      ).rejects.toThrow(
        /O valor solicitado para saque avulso deve ser superior à taxa de transferência bancária de R\$ 5/,
      );
    });

    it('should throw ConflictException if there is already a PENDING withdrawal in-flight', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValueOnce({
        id: 'tx-pending-1',
        status: TransactionStatus.PENDING,
      });

      await expect(
        service.requestInstantWithdrawal('user-owner', { amount: 50 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should revert pending transaction to CANCELED if Asaas transfer fails', async () => {
      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-pending-1' });
      mockAsaasService.transferSubaccountBalance.mockRejectedValueOnce(
        new Error('Asaas API unavailable'),
      );

      await expect(
        service.requestInstantWithdrawal('user-owner', { amount: 50 }),
      ).rejects.toThrow('Asaas API unavailable');

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-pending-1' },
        data: { status: TransactionStatus.CANCELED },
      });
    });

    it('should process instant withdrawal successfully deducting transfer fee', async () => {
      mockAsaasService.transferSubaccountBalance.mockResolvedValue({
        id: 'tra_98765',
        status: 'PENDING',
      });
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-withdraw-1',
        totalValue: 50.0,
        netValue: 45.0,
        asaasFee: 5.0,
        createdAt: new Date(),
      });
      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-withdraw-1',
        totalValue: 50.0,
        netValue: 45.0,
        asaasFee: 5.0,
        status: TransactionStatus.CONFIRMED,
        createdAt: new Date(),
      });

      const result = await service.requestInstantWithdrawal('user-owner', {
        amount: 50.0,
      });

      expect(mockAsaasService.transferSubaccountBalance).toHaveBeenCalledWith(
        'fp-1',
        45.0, // 50 - 5 = 45
        {
          isFreeWeekly: false,
          pixAddressKey: '12345678900',
          pixAddressKeyType: 'CPF',
        },
      );
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WITHDRAWAL',
          status: 'PENDING',
          totalValue: 50.0,
          netValue: 45.0,
          asaasFee: 5.0,
          barberWalletId: 'wal_123',
        }),
      });
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-withdraw-1' },
        data: expect.objectContaining({
          status: TransactionStatus.CONFIRMED,
          asaasPaymentId: 'tra_98765',
        }),
      });
      expect(result.message).toBe('Saque avulso solicitado com sucesso.');
      expect(result.withdrawal.requestedAmount).toBe(50.0);
      expect(result.withdrawal.transferFee).toBe(5.0);
      expect(result.withdrawal.netAmountTransferred).toBe(45.0);
      expect(result.withdrawal.remainingAvailableBalance).toBe(50.0); // 100 - 50 = 50
    });
  });

  describe('getCompanyWithdrawalHistory', () => {
    it('should return withdrawal history with audit details', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        financialProfileId: 'fp-1',
      });
      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        id: 'fp-1',
        walletId: 'wal_123',
        pixAddressKey: '12345678900',
        pixAddressKeyType: 'CPF',
      });
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          totalValue: '100.00',
          netValue: '95.00',
          asaasFee: '5.00',
          status: TransactionStatus.CONFIRMED,
          asaasPaymentId: 'tra_1',
          createdAt: new Date('2026-08-23T10:00:00.000Z'),
        },
        {
          id: 'tx-2',
          totalValue: '200.00',
          netValue: '200.00',
          asaasFee: '0.00',
          status: TransactionStatus.CONFIRMED,
          asaasPaymentId: 'payout_1',
          createdAt: new Date('2026-08-17T06:00:00.000Z'),
        },
      ]);

      const history = await service.getCompanyWithdrawalHistory('user-owner');

      expect(history).toHaveLength(2);
      expect(history[0].requestedAmount).toBe(100.0);
      expect(history[0].transferFee).toBe(5.0);
      expect(history[0].isFreeWeekly).toBe(false);
      expect(history[1].isFreeWeekly).toBe(true);
    });
  });

  describe('executeWeeklyFreePayouts (Cron Semanal Gratuito)', () => {
    it('should execute free payouts only for companies with available balance >= R$ 100.00 (accumulating balances < R$ 100.00)', async () => {
      mockPrisma.company.findMany.mockResolvedValue([
        { id: 'comp-1', businessName: 'Barbearia Alpha', userId: 'user-1' },
        {
          id: 'comp-2',
          businessName: 'Barbearia Beta (Pequena)',
          userId: 'user-2',
        },
        { id: 'comp-3', businessName: 'Barbearia Zero', userId: 'user-3' },
      ]);

      // Mock computeAvailableBalance para as 3 empresas
      const computeSpy = jest
        .spyOn(service as any, 'computeAvailableBalance')
        .mockImplementation(async (companyId: string) => {
          if (companyId === 'comp-1') {
            return {
              availableBalance: 150.0,
              escrowLockedBalance: 50.0,
              completedNetRevenue: 150.0,
              totalWithdrawn: 0,
            };
          }
          if (companyId === 'comp-2') {
            return {
              availableBalance: 45.0,
              escrowLockedBalance: 20.0,
              completedNetRevenue: 45.0,
              totalWithdrawn: 0,
            };
          }
          return {
            availableBalance: 0,
            escrowLockedBalance: 0,
            completedNetRevenue: 0,
            totalWithdrawn: 0,
          };
        });

      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        id: 'fp-1',
        walletId: 'wal_1',
        pixAddressKey: '12345678900',
        pixAddressKeyType: 'CPF',
      });
      mockAsaasService.transferSubaccountBalance.mockReset();
      mockAsaasService.transferSubaccountBalance.mockResolvedValue({
        id: 'tra_payout_1',
      });
      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-payout-1' });
      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-payout-1',
        status: TransactionStatus.CONFIRMED,
      });

      const executedCount = await service.executeWeeklyFreePayouts();

      // Apenas a empresa com R$ 150,00 deve receber o saque gratuito (empresa com R$ 45,00 acumula)
      expect(executedCount).toBe(1);
      expect(mockAsaasService.transferSubaccountBalance).toHaveBeenCalledTimes(
        1,
      );
      expect(mockAsaasService.transferSubaccountBalance).toHaveBeenCalledWith(
        'fp-1',
        150.0,
        {
          isFreeWeekly: true,
          pixAddressKey: '12345678900',
          pixAddressKeyType: 'CPF',
        },
      );
      // Confirma que a transação PENDING foi criada ANTES da chamada
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WITHDRAWAL',
          status: 'PENDING',
          totalValue: 150.0,
          netValue: 150.0,
          paidByPlatform: true,
          asaasFee: 0,
        }),
      });
      // Confirma que a transação foi atualizada para CONFIRMED após a transferência
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-payout-1' },
        data: expect.objectContaining({
          status: TransactionStatus.CONFIRMED,
        }),
      });

      computeSpy.mockRestore();
    });
  });
});
