import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from '../asaas.service';
import { ApptStatus, TransactionStatus } from '@prisma/client';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;
  let asaasService: AsaasService;

  const mockPrisma = {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  const mockAsaasService = {
    refundPayment: jest.fn().mockResolvedValue(true),
    cancelPayment: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AsaasService,
          useValue: mockAsaasService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasService = module.get<AsaasService>(AsaasService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PAYMENT_RECEIVED / PAYMENT_CONFIRMED', () => {
    const mockPayment = { id: 'pay_12345' };
    const mockTransaction = {
      id: 'tx-1',
      asaasPaymentId: 'pay_12345',
      appointmentId: 'appt-1',
      status: TransactionStatus.PENDING,
    };

    it('should confirm transaction and appointment when payment is received in time', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // +10min
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      const result = await service.handleAsaasEvent(
        'PAYMENT_CONFIRMED',
        mockPayment,
      );

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.CONFIRMED },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CONFIRMED },
      });
      expect(mockAsaasService.refundPayment).not.toHaveBeenCalled();
      expect(result).toEqual({
        received: true,
        event: 'PAYMENT_CONFIRMED',
        paymentId: 'pay_12345',
      });
    });

    it('should update asaasFee when fee is provided in webhook payment object', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      const paymentWithFee = {
        id: 'pay_12345',
        fee: 1.49,
        value: 20.0,
        netValue: 18.51,
      };
      await service.handleAsaasEvent('PAYMENT_CONFIRMED', paymentWithFee);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.CONFIRMED, asaasFee: 1.49 },
      });
    });

    it('should compute and update asaasFee from value - netValue when fee is omitted', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      const paymentWithoutFeeField = {
        id: 'pay_12345',
        value: 25.0,
        netValue: 23.01,
      };
      await service.handleAsaasEvent(
        'PAYMENT_RECEIVED',
        paymentWithoutFeeField,
      );

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.CONFIRMED, asaasFee: 1.99 },
      });
    });

    it('should trigger automatic refund and update transaction to REFUNDED when payment is received for CANCELED appointment', async () => {
      const canceledAppt = {
        id: 'appt-1',
        status: ApptStatus.CANCELED,
        isActive: false,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // -5min
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(canceledAppt);

      await service.handleAsaasEvent('PAYMENT_RECEIVED', mockPayment);

      expect(mockAsaasService.refundPayment).toHaveBeenCalledWith(
        'pay_12345',
        undefined,
        expect.stringContaining('Estorno automático'),
      );
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.REFUNDED },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CANCELED, isActive: false },
      });
    });

    it('should trigger automatic refund when payment is received for expired PENDING_PAYMENT appointment', async () => {
      const expiredPendingAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // já expirou
      };

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(expiredPendingAppt);

      await service.handleAsaasEvent('PAYMENT_RECEIVED', mockPayment);

      expect(mockAsaasService.refundPayment).toHaveBeenCalledWith(
        'pay_12345',
        undefined,
        expect.stringContaining('Estorno automático'),
      );
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.REFUNDED },
      });
    });
  });

  describe('PAYMENT_OVERDUE / PAYMENT_DELETED', () => {
    it('should mark transaction and appointment as CANCELED', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
      });

      await service.handleAsaasEvent('PAYMENT_OVERDUE', { id: 'pay_12345' });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.CANCELED },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CANCELED, isActive: false },
      });
    });
  });

  describe('PAYMENT_REFUNDED', () => {
    it('should mark transaction as REFUNDED and cancel appointment', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
      });

      await service.handleAsaasEvent('PAYMENT_REFUNDED', { id: 'pay_12345' });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.REFUNDED },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CANCELED, isActive: false },
      });
    });
  });

  describe('PAYMENT_CHARGEBACK_REQUESTED / PAYMENT_CHARGEBACK_DISPUTE', () => {
    it('should mark transaction and appointment as CANCELED on chargeback dispute', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
      });

      await service.handleAsaasEvent('PAYMENT_CHARGEBACK_DISPUTE', {
        id: 'pay_12345',
      });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.CANCELED },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CANCELED, isActive: false },
      });
    });
  });
});
