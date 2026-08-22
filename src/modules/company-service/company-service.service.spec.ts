import { Test, TestingModule } from '@nestjs/testing';
import { CompanyServiceService } from './company-service.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import { NotFoundException } from '@nestjs/common';

describe('CompanyServiceService', () => {
  let service: CompanyServiceService;
  let prisma: PrismaService;
  let calculateTax: CalculateTax;

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
      ],
    }).compile();

    service = module.get<CompanyServiceService>(CompanyServiceService);
    prisma = module.get<PrismaService>(PrismaService);
    calculateTax = module.get<CalculateTax>(CalculateTax);
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

    it('should return services with calculated platformTax in Reais', async () => {
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
      mockCalculateTax.calculatePlatformTax.mockReturnValue(7.5); // R$ 7,50

      const result = await service.getServicesBySlug('barbearia');

      expect(mockCalculateTax.calculatePlatformTax).toHaveBeenCalledWith(50.0);
      expect(result).toEqual([
        {
          ...mockServices[0],
          platformTax: 7.5,
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

    it('should throw NotFoundException if serviceGroup does not belong to the user company (Anti-IDOR)', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'comp-1' });
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

    it('should create service when company and serviceGroup are valid', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'comp-1' });
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
          downPaymentPercent: createDto.downPaymentPercent,
          serviceGroupId: createDto.serviceGroupId,
          companyId: 'comp-1',
        },
      });
      expect(result).toEqual(createdService);
    });
  });

  describe('updateService', () => {
    it('should throw NotFoundException if updating to a serviceGroupId of another company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'comp-1' });
      mockPrisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        companyId: 'comp-1',
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
