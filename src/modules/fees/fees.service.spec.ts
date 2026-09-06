import { Test, TestingModule } from '@nestjs/testing';
import { FeeOverrideStatus, FeeOverrideSource } from '@prisma/client';
import {
  BARBER_ASAAS_PIX_FEE,
  MIN_PROMO_BARBER_FEE,
} from '../../common/constants/billing.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { FeesService } from './fees.service';

describe('FeesService', () => {
  let service: FeesService;
  let prisma: {
    feeOverride: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      feeOverride: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<FeesService>(FeesService);
  });

  describe('getEffectiveBarberFee', () => {
    it('deve retornar a taxa padrão (0.99) quando não houver override ativo', async () => {
      prisma.feeOverride.findMany.mockResolvedValue([]);

      const result = await service.getEffectiveBarberFee('company-1');

      expect(result).toEqual({
        fee: BARBER_ASAAS_PIX_FEE,
        isPromotional: false,
      });
      expect(prisma.feeOverride.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          status: FeeOverrideStatus.ACTIVE,
          startsAt: { lte: expect.any(Date) },
          endsAt: { gte: expect.any(Date) },
        },
        orderBy: { barberPixFee: 'asc' },
      });
    });

    it('deve retornar a taxa promocional do override (0.49)', async () => {
      prisma.feeOverride.findMany.mockResolvedValue([
        {
          id: 'override-1',
          companyId: 'company-1',
          barberPixFee: 0.49,
          status: FeeOverrideStatus.ACTIVE,
        },
      ]);

      const result = await service.getEffectiveBarberFee('company-1');

      expect(result).toEqual({
        fee: 0.49,
        overrideId: 'override-1',
        isPromotional: true,
      });
    });

    it('não deve permitir taxa inferior a MIN_PROMO_BARBER_FEE (0.49)', async () => {
      prisma.feeOverride.findMany.mockResolvedValue([
        {
          id: 'override-zero',
          companyId: 'company-1',
          barberPixFee: 0.1,
          status: FeeOverrideStatus.ACTIVE,
        },
      ]);

      const result = await service.getEffectiveBarberFee('company-1');

      expect(result.fee).toBe(MIN_PROMO_BARBER_FEE);
      expect(result.isPromotional).toBe(true);
    });
  });

  describe('createOverride', () => {
    it('deve criar um override respeitando o piso de 0.49', async () => {
      const now = new Date();
      const in15d = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      prisma.feeOverride.create.mockResolvedValue({
        id: 'new-override',
        companyId: 'company-1',
        barberPixFee: 0.49,
        startsAt: now,
        endsAt: in15d,
        source: FeeOverrideSource.FOUNDER,
        status: FeeOverrideStatus.ACTIVE,
      });

      const result = await service.createOverride({
        companyId: 'company-1',
        barberPixFee: 0.49,
        startsAt: now,
        endsAt: in15d,
        source: FeeOverrideSource.FOUNDER,
      });

      expect(result.id).toBe('new-override');
      expect(prisma.feeOverride.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-1',
          barberPixFee: 0.49,
          startsAt: now,
          endsAt: in15d,
          source: FeeOverrideSource.FOUNDER,
          sourceId: undefined,
          status: FeeOverrideStatus.ACTIVE,
        },
      });
    });
  });

  describe('handleExpiredOverrides', () => {
    it('deve marcar overrides vencidos como EXPIRED', async () => {
      prisma.feeOverride.updateMany.mockResolvedValue({ count: 2 });
      prisma.feeOverride.findMany.mockResolvedValue([]);

      await service.handleExpiredOverrides();

      expect(prisma.feeOverride.updateMany).toHaveBeenCalledWith({
        where: {
          status: FeeOverrideStatus.ACTIVE,
          endsAt: { lt: expect.any(Date) },
        },
        data: {
          status: FeeOverrideStatus.EXPIRED,
        },
      });
    });
  });
});
