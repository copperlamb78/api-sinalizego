import { Test, TestingModule } from '@nestjs/testing';
import { ClientCreditsService } from './client-credits.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreditStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('ClientCreditsService', () => {
  let service: ClientCreditsService;
  let prisma: {
    clientCredit: {
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    company: {
      findFirst: jest.Mock;
    };
  };

  const mockPrismaService = {
    clientCredit: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientCreditsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClientCreditsService>(ClientCreditsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyCredits', () => {
    it('deve retornar créditos do cliente agrupados por empresa e atualizar expirados', async () => {
      prisma.clientCredit.updateMany.mockResolvedValue({ count: 0 });

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const mockCredits = [
        {
          id: 'credit-1',
          clientId: 'user-1',
          companyId: 'comp-1',
          amount: '45.00',
          status: CreditStatus.AVAILABLE,
          expiresAt: futureDate,
          createdAt: new Date(),
          usedAt: null,
          company: {
            id: 'comp-1',
            businessName: 'Barbearia VIP',
            slug: 'barbearia-vip',
            logoPhoto: null,
            district: 'Centro',
            city: 'São Paulo',
          },
        },
        {
          id: 'credit-2',
          clientId: 'user-1',
          companyId: 'comp-1',
          amount: '30.00',
          status: CreditStatus.AVAILABLE,
          expiresAt: futureDate,
          createdAt: new Date(),
          usedAt: null,
          company: {
            id: 'comp-1',
            businessName: 'Barbearia VIP',
            slug: 'barbearia-vip',
            logoPhoto: null,
            district: 'Centro',
            city: 'São Paulo',
          },
        },
      ];

      prisma.clientCredit.findMany.mockResolvedValue(mockCredits);

      const result = await service.getMyCredits('user-1');

      expect(prisma.clientCredit.updateMany).toHaveBeenCalled();
      expect(result.totalAvailable).toBe(75);
      expect(result.availableByCompany).toHaveLength(1);
      expect(result.availableByCompany[0].businessName).toBe('Barbearia VIP');
      expect(result.availableByCompany[0].totalAmount).toBe(75);
      expect(result.allCredits).toHaveLength(2);
    });
  });

  describe('getCompanyCreditBalance', () => {
    it('deve retornar o saldo de crédito disponível para uma empresa específica', async () => {
      prisma.clientCredit.updateMany.mockResolvedValue({ count: 0 });

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      prisma.clientCredit.findMany.mockResolvedValue([
        {
          id: 'credit-1',
          amount: '45.00',
          expiresAt: futureDate,
        },
      ]);

      const result = await service.getCompanyCreditBalance('user-1', 'comp-1');

      expect(result.companyId).toBe('comp-1');
      expect(result.availableAmount).toBe(45);
      expect(result.creditsCount).toBe(1);
    });
  });

  describe('getCompanyCreditsForOwner', () => {
    it('deve permitir dono da barbearia visualizar créditos de clientes', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'comp-1' });

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      prisma.clientCredit.findMany.mockResolvedValue([
        {
          id: 'credit-1',
          amount: '45.00',
          status: CreditStatus.AVAILABLE,
          expiresAt: futureDate,
          createdAt: new Date(),
          usedAt: null,
          client: {
            id: 'client-1',
            name: 'Maria',
            email: 'maria@test.com',
            phone: '11999999999',
          },
        },
      ]);

      const result = await service.getCompanyCreditsForOwner('owner-1', 'comp-1');

      expect(result.companyId).toBe('comp-1');
      expect(result.totalActiveInCustody).toBe(45);
      expect(result.credits).toHaveLength(1);
    });

    it('deve lançar ForbiddenException se o usuário não for o dono da empresa', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.getCompanyCreditsForOwner('intruder-1', 'comp-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
