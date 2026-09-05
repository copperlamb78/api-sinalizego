import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;
  let asaas: AsaasService;

  const mockPrisma = {
    appointment: {
      findUnique: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAsaas = {
    getPixQrCode: jest.fn(),
    createPixChargeWithSplit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AsaasService,
          useValue: mockAsaas,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
    asaas = module.get<AsaasService>(AsaasService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPixForAppointment', () => {
    const validAppointment = {
      id: 'appointment-1',
      clientId: 'client-1',
      status: 'PENDING_PAYMENT',
      expiresAt: new Date(Date.now() + 600000), // +10 min
      downPaymentAmount: 50.0,
      platformFeeAmount: 7.5,
      company: {
        id: 'company-1',
        isActive: true,
        financialProfile: {
          walletId: 'wallet-1',
        },
      },
      client: {
        id: 'client-1',
        asaasCustomerId: 'cus_12345',
      },
      service: {
        id: 'service-1',
        name: 'Corte',
      },
    };

    it('should throw NotFoundException if appointment does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.createPixForAppointment('invalid-id', 'client-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if company is inactive (F-19)', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...validAppointment,
        company: {
          ...validAppointment.company,
          isActive: false,
        },
      });

      await expect(
        service.createPixForAppointment('appointment-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if appointment belongs to a different user', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(validAppointment);

      await expect(
        service.createPixForAppointment('appointment-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if appointment is not in PENDING_PAYMENT status', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...validAppointment,
        status: 'CONFIRMED',
      });

      await expect(
        service.createPixForAppointment('appointment-1', 'client-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw GoneException if appointment reservation has expired', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...validAppointment,
        expiresAt: new Date(Date.now() - 1000), // já expirou
      });

      await expect(
        service.createPixForAppointment('appointment-1', 'client-1'),
      ).rejects.toThrow(GoneException);
    });

    it('should throw NotFoundException if company has no walletId configured', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...validAppointment,
        company: { id: 'company-1', isActive: true, financialProfile: null },
      });

      await expect(
        service.createPixForAppointment('appointment-1', 'client-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if client has no asaasCustomerId', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        ...validAppointment,
        client: { id: 'client-1', asaasCustomerId: null },
      });

      await expect(
        service.createPixForAppointment('appointment-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing pending Pix charge if already created (Idempotency)', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(validAppointment);
      mockPrisma.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        asaasPaymentId: 'pay_existing_123',
        totalValue: 52.0,
        netValue: 49.01,
        platformFee: 2.0,
        asaasFee: 0.99,
      });

      mockAsaas.getPixQrCode.mockResolvedValue({
        qrCodePayload: 'payload_existing',
        qrCodeImage: 'image_existing',
        expirationDate: new Date(),
      });

      const result = await service.createPixForAppointment(
        'appointment-1',
        'client-1',
      );

      expect(mockAsaas.getPixQrCode).toHaveBeenCalledWith('pay_existing_123');
      expect(mockAsaas.createPixChargeWithSplit).not.toHaveBeenCalled();
      expect(result.paymentId).toEqual('pay_existing_123');
      expect(result.qrCodePayload).toEqual('payload_existing');
    });

    it('should create a new Pix charge with split using frozen platformFeeAmount and save Transaction', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(validAppointment);
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      const pixResponse = {
        paymentId: 'pay_new_456',
        totalValue: 57.5,
        qrCodePayload: 'payload_new',
        qrCodeImage: 'image_new',
        expirationDate: new Date(),
        barberNetValue: 49.01,
        platformFee: 7.5,
        asaasFee: 0.99,
      };

      mockAsaas.createPixChargeWithSplit.mockResolvedValue(pixResponse);
      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-new',
        ...pixResponse,
      });

      const result = await service.createPixForAppointment(
        'appointment-1',
        'client-1',
      );

      expect(mockAsaas.createPixChargeWithSplit).toHaveBeenCalledWith(
        'cus_12345',
        'wallet-1',
        50.0,
        'appointment-1',
        7.5,
      );
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          asaasPaymentId: 'pay_new_456',
          totalValue: 57.5,
          status: 'PENDING',
          customerId: 'client-1',
          barberWalletId: 'wallet-1',
          appointmentId: 'appointment-1',
        }),
      });
      expect(result).toEqual(pixResponse);
    });
  });
});
