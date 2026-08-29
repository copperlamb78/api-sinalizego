import { Test, TestingModule } from '@nestjs/testing';
import { CompanyServiceService } from './company-service.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import { CalculateDeposit } from 'src/helpers/calculate-deposit.helper';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CompanyServiceService', () => {
  let service: CompanyServiceService;
  let prisma: PrismaService;
  let calculateTax: CalculateTax;
  let calculateDeposit: CalculateDeposit;

  const mockPrisma = {
    company: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    service: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCalculateTax = {
    calculatePlatformTax: jest.fn().mockReturnValue(7.5),
    calculatePlatformTaxPercentage: jest.fn().mockReturnValue(0.15),
  };

  const mockCalculateDeposit = {
    calculateDeposit: jest.fn().mockReturnValue(25.0),
    calculateDepositDetails: jest.fn(),
    getAvailableBlocks: jest.fn().mockReturnValue([50]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyServiceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CalculateTax,
          useValue: mockCalculateTax,
        },
        {
          provide: CalculateDeposit,
          useValue: mockCalculateDeposit,
        },
      ],
    }).compile();

    service = module.get<CompanyServiceService>(CompanyServiceService);
    prisma = module.get<PrismaService>(PrismaService);
    calculateTax = module.get<CalculateTax>(CalculateTax);
    calculateDeposit = module.get<CalculateDeposit>(CalculateDeposit);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getServicesBySlug (Vitrine)', () => {
    it('should throw NotFoundException if company is not found by slug', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getServicesBySlug('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if company has no active services', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        slug: 'barbearia',
      });
      mockPrisma.service.findMany.mockResolvedValue([]);

      await expect(service.getServicesBySlug('barbearia')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return services with calculated downPaymentAmount and platformTax in Reais', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        slug: 'barbearia',
      });
      const mockServices = [
        {
          id: 'svc-1',
          name: 'Corte Tradicional',
          totalPrice: 50.0,
          downPaymentPercent: 50,
          companyId: 'comp-1',
          isActive: true,
        },
      ];
      mockPrisma.service.findMany.mockResolvedValue(mockServices);
      mockCalculateDeposit.calculateDeposit.mockReturnValue(25.0);
      mockCalculateTax.calculatePlatformTax.mockReturnValue(2.5);

      const result = await service.getServicesBySlug('barbearia');

      expect(mockCalculateDeposit.calculateDeposit).toHaveBeenCalledWith(50.0, 50);
      expect(mockCalculateTax.calculatePlatformTax).toHaveBeenCalledWith(25.0);
      expect(result).toEqual([
        {
          ...mockServices[0],
          totalPrice: 50.0,
          downPaymentAmount: 25.0,
          platformTax: 2.5,
        },
      ]);
    });
  });

  describe('createService', () => {
    const createDto = {
      name: 'Corte Masculino',
      durationMinutes: 45,
      totalPrice: 40.0,
      downPaymentPercent: 50,
      serviceGroupId: 'group-uuid-1',
    };

    it('should throw NotFoundException if user has no company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.createService(createDto as any, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if company does not have a financialProfile with walletId (Onboarding Gate)', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        financialProfile: null,
      });

      await expect(
        service.createService(createDto as any, 'user-1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Para cadastrar serviços, você precisa primeiro configurar sua conta bancária/financeira no painel.',
        ),
      );
    });

    it('should throw NotFoundException if serviceGroup does not belong to the user company (Anti-IDOR)', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        financialProfile: { walletId: 'wal_123' },
      });
      mockPrisma.serviceGroup = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.createService(createDto as any, 'user-1'),
      ).rejects.toThrow(
        new NotFoundException(
          'Grupo de serviços não encontrado ou não pertence a esta empresa.',
        ),
      );
    });

    it('should create service when company, financialProfile and serviceGroup are valid', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        financialProfile: { walletId: 'wal_123' },
      });
      mockPrisma.serviceGroup = {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'group-uuid-1', companyId: 'comp-1' }),
      };
      const createdService = {
        id: 'svc-1',
        ...createDto,
        companyId: 'comp-1',
      };
      mockPrisma.service.create.mockResolvedValue(createdService);

      const result = await service.createService(createDto as any, 'user-1');

      expect(mockPrisma.service.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          description: undefined,
          durationMinutes: createDto.durationMinutes,
          totalPrice: createDto.totalPrice,
          downPaymentPercent: 50,
          serviceGroupId: createDto.serviceGroupId,
          companyId: 'comp-1',
        },
      });
      expect(result).toEqual(createdService);
    });

    it('should normalize downPaymentPercent to 50% if price is below R$ 400.00 even if 30% requested', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        financialProfile: { walletId: 'wal_123' },
      });
      mockPrisma.serviceGroup = {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'group-uuid-1', companyId: 'comp-1' }),
      };
      mockPrisma.service.create.mockImplementation((args) => args.data);

      const result = await service.createService(
        {
          name: 'Barba Terapia',
          durationMinutes: 30,
          totalPrice: 150.0,
          downPaymentPercent: 30,
          serviceGroupId: 'group-uuid-1',
        } as any,
        'user-1',
      );

      expect(result.downPaymentPercent).toBe(50);
    });

    it('should allow 30% downPaymentPercent if price is >= R$ 400.00', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        financialProfile: { walletId: 'wal_123' },
      });
      mockPrisma.serviceGroup = {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'group-uuid-1', companyId: 'comp-1' }),
      };
      mockPrisma.service.create.mockImplementation((args) => args.data);

      const result = await service.createService(
        {
          name: 'Mega Hair Especial',
          durationMinutes: 180,
          totalPrice: 600.0,
          downPaymentPercent: 30,
          serviceGroupId: 'group-uuid-1',
        } as any,
        'user-1',
      );

      expect(result.downPaymentPercent).toBe(30);
    });
  });

  describe('updateService', () => {
    it('should throw NotFoundException if updating to a serviceGroupId of another company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'comp-1' });
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        companyId: 'comp-1',
        totalPrice: 50.0,
      });
      mockPrisma.serviceGroup = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.updateService('user-1', 'svc-1', {
          serviceGroupId: 'foreign-group-uuid',
        }),
      ).rejects.toThrow(
        new NotFoundException(
          'Grupo de serviços não encontrado ou não pertence a esta empresa.',
        ),
      );
    });
  });
});
