import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  FeeOverrideStatus,
  FounderSeatStatus,
  ReferralStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FeesService } from '../fees/fees.service';
import { MailService } from '../mail/mail.service';
import { ReferralsService } from './referrals.service';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: any;
  let feesService: any;
  let mailService: any;

  beforeEach(async () => {
    prisma = {
      referralCode: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      referral: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      company: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      founderSeat: {
        findFirst: jest.fn(),
      },
      feeOverride: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    feesService = {
      createOverride: jest.fn(),
    };

    mailService = {
      sendReferralReviewAlertEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FeesService, useValue: feesService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://app.sinalizego.com'),
          },
        },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
  });

  describe('getOrCreateReferralCode', () => {
    it('deve retornar o código existente se já houver um cadastrado', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        code: 'XYZ12345',
        referrerCompanyId: 'comp-1',
        active: true,
        createdAt: new Date(),
      });

      const result = await service.getOrCreateReferralCode('comp-1');

      expect(result.code).toBe('XYZ12345');
      expect(result.link).toContain('ref=XYZ12345');
    });

    it('deve gerar um novo código se não existir', async () => {
      prisma.referralCode.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // checagem de unicidade
      prisma.referralCode.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...data,
          createdAt: new Date(),
        }),
      );

      const result = await service.getOrCreateReferralCode('comp-1');

      expect(result.code).toBeDefined();
      expect(result.code.length).toBe(8);
      expect(prisma.referralCode.create).toHaveBeenCalled();
    });
  });

  describe('attachReferral', () => {
    it('deve ignorar tentativa de auto-indicação', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'AUTO1234',
        referrerCompanyId: 'comp-1',
        active: true,
      });

      const result = await service.attachReferral('comp-1', 'AUTO1234');

      expect(result).toBeNull();
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('deve marcar REVIEW se houver coincidência de telefone ou endereço', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'REF12345',
        referrerCompanyId: 'comp-referrer',
        active: true,
      });

      prisma.referral.findUnique.mockResolvedValue(null);

      prisma.company.findUnique
        .mockResolvedValueOnce({
          id: 'comp-referred',
          businessName: 'Barbearia B',
          zipCode: '12345678',
          number: '10',
          owner: { phone: '11999999999' },
        })
        .mockResolvedValueOnce({
          id: 'comp-referrer',
          businessName: 'Barbearia A',
          zipCode: '12345678',
          number: '10', // mesmo endereço
          owner: { phone: '11988888888' },
        });

      prisma.referral.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'ref-1', ...data }),
      );

      const result = await service.attachReferral('comp-referred', 'REF12345');

      expect(result?.status).toBe(ReferralStatus.REVIEW);
      expect(result?.riskFlags).toContain('SAME_ADDRESS');
      expect(mailService.sendReferralReviewAlertEmail).toHaveBeenCalled();
    });
  });

  describe('onSubaccountApproved', () => {
    it('deve direcionar para REVIEW se detectar a mesma chave Pix', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        referredCompanyId: 'comp-referred',
        referrerCompanyId: 'comp-referrer',
        status: ReferralStatus.PENDING,
        riskFlags: [],
      });

      prisma.company.findUnique
        .mockResolvedValueOnce({
          id: 'comp-referred',
          businessName: 'Barbearia B',
          financialProfile: { pixAddressKey: 'mesma-chave@pix.com' },
          owner: {},
        })
        .mockResolvedValueOnce({
          id: 'comp-referrer',
          businessName: 'Barbearia A',
          financialProfile: { pixAddressKey: 'mesma-chave@pix.com' },
          owner: {},
        });

      prisma.referral.update.mockResolvedValue({});

      await service.onSubaccountApproved('comp-referred');

      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: { id: 'ref-1' },
        data: {
          status: ReferralStatus.REVIEW,
          riskFlags: ['SAME_PIX_KEY'],
        },
      });
      expect(mailService.sendReferralReviewAlertEmail).toHaveBeenCalled();
      expect(feesService.createOverride).not.toHaveBeenCalled();
    });

    it('deve ativar a promoção para ambos quando a aprovação for legítima', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        referredCompanyId: 'comp-referred',
        referrerCompanyId: 'comp-referrer',
        status: ReferralStatus.PENDING,
        riskFlags: [],
      });

      prisma.company.findUnique
        .mockResolvedValueOnce({
          id: 'comp-referred',
          businessName: 'Barbearia B',
          financialProfile: {
            pixAddressKey: 'chave-b@pix.com',
            cpfCnpj: '11111111111',
          },
          owner: { cpfCnpj: '11111111111' },
        })
        .mockResolvedValueOnce({
          id: 'comp-referrer',
          businessName: 'Barbearia A',
          financialProfile: {
            pixAddressKey: 'chave-a@pix.com',
            cpfCnpj: '22222222222',
          },
          owner: { cpfCnpj: '22222222222' },
        });

      feesService.createOverride.mockResolvedValue({
        id: 'override-recipient',
      });
      prisma.referral.findMany.mockResolvedValue([]); // sem indicações anteriores no ciclo
      prisma.founderSeat.findFirst.mockResolvedValue(null); // não é fundador
      prisma.feeOverride.findFirst.mockResolvedValue(null); // sem override ativo

      prisma.referral.update.mockResolvedValue({});

      await service.onSubaccountApproved('comp-referred');

      expect(feesService.createOverride).toHaveBeenCalledTimes(2); // 1 para o indicado, 1 para o indicador
      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: { id: 'ref-1' },
        data: expect.objectContaining({
          status: ReferralStatus.ACTIVATED,
        }),
      });
    });

    it('deve enfileirar (QUEUED) os 15 dias do indicador caso ele seja Fundador ativo', async () => {
      prisma.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        referredCompanyId: 'comp-referred',
        referrerCompanyId: 'comp-referrer',
        status: ReferralStatus.PENDING,
        riskFlags: [],
      });

      prisma.company.findUnique
        .mockResolvedValueOnce({
          id: 'comp-referred',
          financialProfile: { pixAddressKey: 'chave-b@pix.com' },
          owner: {},
        })
        .mockResolvedValueOnce({
          id: 'comp-referrer',
          financialProfile: { pixAddressKey: 'chave-a@pix.com' },
          owner: {},
        });

      feesService.createOverride.mockResolvedValue({ id: 'override-id' });
      prisma.referral.findMany.mockResolvedValue([]);
      prisma.founderSeat.findFirst.mockResolvedValue({
        id: 'founder-seat-1',
        status: FounderSeatStatus.ACTIVE,
      });

      await service.onSubaccountApproved('comp-referred');

      // O override do indicador deve ter status QUEUED
      expect(feesService.createOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'comp-referrer',
          status: FeeOverrideStatus.QUEUED,
        }),
      );
    });
  });
});
