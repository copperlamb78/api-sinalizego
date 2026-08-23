import { Test, TestingModule } from '@nestjs/testing';
import { CompanyService } from './company.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SlugHelper } from './helpers/create-slug.helper';
import { AuthService } from '../auth/auth.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ApptStatus, Role } from '@prisma/client';

describe('CompanyService', () => {
  let service: CompanyService;
  let prisma: PrismaService;
  let slugHelper: SlugHelper;
  let authService: AuthService;

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
    },
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
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    prisma = module.get<PrismaService>(PrismaService);
    slugHelper = module.get<SlugHelper>(SlugHelper);
    authService = module.get<AuthService>(AuthService);

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
      expect(result.volume.pendingPayment).toBe(1);
      // CompletionRate = (2 / (2 + 1 + 1)) * 100 = 50.00%
      expect(result.volume.completionRate).toBe(50.0);

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
        select: { id: true, businessName: true, slug: true },
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
});
