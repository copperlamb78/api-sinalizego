import { Test, TestingModule } from '@nestjs/testing';
import {
  FeeOverrideSource,
  FeeOverrideStatus,
  FounderSeatStatus,
  WaitlistStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { FeesService } from '../fees/fees.service';
import { FoundersService } from './founders.service';

describe('FoundersService', () => {
  let service: FoundersService;
  let prisma: any;
  let companyService: any;
  let feesService: any;

  beforeEach(async () => {
    prisma = {
      founderSeat: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      founderWaitlist: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      feeOverride: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      appointment: {
        count: jest.fn(),
      },
    };

    companyService = {
      createCompanyWithUser: jest.fn(),
    };

    feesService = {
      createOverride: jest.fn(),
      revokeOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoundersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CompanyService, useValue: companyService },
        { provide: FeesService, useValue: feesService },
      ],
    }).compile();

    service = module.get<FoundersService>(FoundersService);
  });

  describe('registerFounder', () => {
    it('deve reservar uma vaga quando houver menos de 20 vagas ocupadas', async () => {
      prisma.founderSeat.findMany.mockResolvedValue([
        { seatNumber: 1 },
        { seatNumber: 2 },
      ]);

      companyService.createCompanyWithUser.mockResolvedValue({
        message: 'Empresa criada com sucesso',
        user: { companies: [{ id: 'company-new' }] },
      });

      prisma.founderSeat.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'seat-3',
          seatNumber: 3,
          status: FounderSeatStatus.RESERVED,
          reserveExpiresAt: data.reserveExpiresAt,
        }),
      );

      const result = await service.registerFounder({
        name: 'Dono',
        email: 'dono@teste.com',
        password: 'password123',
        phone: '11999999999',
        providerType: 'Barbearia',
        businessName: 'Barbearia Nova',
        state: 'SP',
        city: 'São Paulo',
        district: 'Centro',
        street: 'Rua A',
        zipCode: '01001000',
        number: '10',
        surveyConsent: true,
      });

      expect(result.founder).toBeDefined();
      expect(result.founder.seatNumber).toBe(3);
      expect(result.founder.status).toBe(FounderSeatStatus.RESERVED);
      expect(prisma.founderSeat.create).toHaveBeenCalled();
    });

    it('deve alocar na lista de espera quando as 20 vagas estiverem ocupadas', async () => {
      const allSeats = Array.from({ length: 20 }, (_, i) => ({
        seatNumber: i + 1,
      }));
      prisma.founderSeat.findMany.mockResolvedValue(allSeats);
      prisma.founderWaitlist.count.mockResolvedValue(2);

      companyService.createCompanyWithUser.mockResolvedValue({
        message: 'Empresa criada com sucesso',
        user: { companies: [{ id: 'company-waitlist' }] },
      });

      prisma.founderWaitlist.create.mockImplementation(() =>
        Promise.resolve({
          id: 'wl-3',
          position: 3,
          status: WaitlistStatus.WAITING,
        }),
      );

      const result = await service.registerFounder({
        name: 'Dono 21',
        email: 'dono21@teste.com',
        password: 'password123',
        phone: '11999999999',
        providerType: 'Barbearia',
        businessName: 'Barbearia 21',
        state: 'SP',
        city: 'São Paulo',
        district: 'Centro',
        street: 'Rua A',
        zipCode: '01001000',
        number: '10',
        surveyConsent: true,
      });

      expect(result.waitlist).toBeDefined();
      expect(result.waitlist.position).toBe(3);
      expect(result.waitlist.status).toBe(WaitlistStatus.WAITING);
    });
  });

  describe('onSubaccountApproved', () => {
    it('deve promover para SECURED e ativar FeeOverride de 0.49 se estiver dentro do prazo', async () => {
      const now = new Date();
      const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      prisma.founderSeat.findUnique.mockResolvedValue({
        id: 'seat-1',
        seatNumber: 1,
        companyId: 'company-1',
        status: FounderSeatStatus.RESERVED,
        reserveExpiresAt: in7d,
      });

      feesService.createOverride.mockResolvedValue({ id: 'override-founder' });
      prisma.founderSeat.update.mockResolvedValue({});

      await service.onSubaccountApproved('company-1');

      expect(feesService.createOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          barberPixFee: 0.49,
          source: FeeOverrideSource.FOUNDER,
          status: FeeOverrideStatus.ACTIVE,
        }),
      );

      expect(prisma.founderSeat.update).toHaveBeenCalledWith({
        where: { id: 'seat-1' },
        data: expect.objectContaining({
          status: FounderSeatStatus.SECURED,
          feeOverrideId: 'override-founder',
        }),
      });
    });

    it('deve marcar FORFEITED se o prazo de 14 dias de reserva tiver expirado', async () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

      prisma.founderSeat.findUnique.mockResolvedValue({
        id: 'seat-1',
        seatNumber: 1,
        companyId: 'company-1',
        status: FounderSeatStatus.RESERVED,
        reserveExpiresAt: past,
      });

      prisma.founderWaitlist.findFirst.mockResolvedValue(null);

      await service.onSubaccountApproved('company-1');

      expect(prisma.founderSeat.update).toHaveBeenCalledWith({
        where: { id: 'seat-1' },
        data: expect.objectContaining({
          status: FounderSeatStatus.FORFEITED,
          forfeitReason: 'RESERVE_EXPIRED',
        }),
      });
      expect(feesService.createOverride).not.toHaveBeenCalled();
    });
  });

  describe('onAppointmentCompleted', () => {
    it('deve promover de SECURED para PROVING no 1º COMPLETED e estender override para 365 dias', async () => {
      prisma.founderSeat.findUnique.mockResolvedValue({
        id: 'seat-1',
        seatNumber: 1,
        companyId: 'company-1',
        status: FounderSeatStatus.SECURED,
        feeOverrideId: 'override-founder',
      });

      prisma.feeOverride.update.mockResolvedValue({});
      prisma.founderSeat.update.mockResolvedValue({});

      await service.onAppointmentCompleted('company-1');

      expect(prisma.feeOverride.update).toHaveBeenCalledWith({
        where: { id: 'override-founder' },
        data: {
          endsAt: expect.any(Date),
        },
      });

      expect(prisma.founderSeat.update).toHaveBeenCalledWith({
        where: { id: 'seat-1' },
        data: expect.objectContaining({
          status: FounderSeatStatus.PROVING,
          activatedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('evaluateFoundersCron', () => {
    it('deve revogar o override e marcar FORFEITED caso não cumpra a meta do mês 1 (< 20)', async () => {
      const activatedAt = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);

      prisma.founderSeat.findMany
        .mockResolvedValueOnce([]) // expiredReservations
        .mockResolvedValueOnce([
          {
            id: 'seat-1',
            seatNumber: 1,
            companyId: 'company-1',
            status: FounderSeatStatus.PROVING,
            activatedAt,
            month1EvaluatedAt: null,
            feeOverrideId: 'override-1',
          },
        ]);

      prisma.founderWaitlist.findMany.mockResolvedValue([]); // expiredOffers
      prisma.appointment.count.mockResolvedValue(15); // Meta é 20, fez 15
      prisma.founderWaitlist.findFirst.mockResolvedValue(null);

      await service.evaluateFoundersCron();

      expect(feesService.revokeOverride).toHaveBeenCalledWith(
        'override-1',
        expect.stringContaining('Mês 1'),
      );

      expect(prisma.founderSeat.update).toHaveBeenCalledWith({
        where: { id: 'seat-1' },
        data: expect.objectContaining({
          status: FounderSeatStatus.FORFEITED,
          month1Passed: false,
          forfeitReason: 'MONTH1_TARGET_NOT_MET',
        }),
      });
    });

    it('deve aprovar mês 1 quando atingir a meta (>= 20)', async () => {
      const activatedAt = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);

      prisma.founderSeat.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'seat-1',
            seatNumber: 1,
            companyId: 'company-1',
            status: FounderSeatStatus.PROVING,
            activatedAt,
            month1EvaluatedAt: null,
            feeOverrideId: 'override-1',
          },
        ]);

      prisma.founderWaitlist.findMany.mockResolvedValue([]);
      prisma.appointment.count.mockResolvedValue(22); // Meta é 20, fez 22

      await service.evaluateFoundersCron();

      expect(feesService.revokeOverride).not.toHaveBeenCalled();
      expect(prisma.founderSeat.update).toHaveBeenCalledWith({
        where: { id: 'seat-1' },
        data: expect.objectContaining({
          month1Count: 22,
          month1Passed: true,
        }),
      });
    });
  });
});
