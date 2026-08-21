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
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1', slug: 'barbearia' });
      mockPrisma.service.findMany.mockResolvedValue([]);

      await expect(service.getServicesBySlug('barbearia')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return services with calculated platformTax in Reais', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1', slug: 'barbearia' });
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
});
