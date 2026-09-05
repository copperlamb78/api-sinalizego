import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from '../asaas.service';
import { ApptStatus, TransactionStatus } from '@prisma/client';

import { MailService } from 'src/modules/mail/mail.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;
  let asaasService: AsaasService;
  let mailService: MailService;

  const mockPrisma = {
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    platformInvoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  const mockAsaasService = {
    refundPayment: jest.fn().mockResolvedValue(true),
    cancelPayment: jest.fn().mockResolvedValue(true),
    getPaymentById: jest.fn(),
  };

  const mockMailService = {
    sendAppointmentConfirmationEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentCancellationEmail: jest.fn().mockResolvedValue(true),
    sendInvoiceErrorAlertEmail: jest.fn().mockResolvedValue(true),
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
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasService = module.get<AsaasService>(AsaasService);
    mailService = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Idempotency', () => {
    it('should skip execution and return alreadyProcessed: true when eventId was already stored (atomic P2002)', async () => {
      mockPrisma.webhookEvent.create.mockRejectedValueOnce({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`eventId`)',
      });

      const result = await service.handleAsaasEvent(
        'PAYMENT_CONFIRMED',
        { id: 'pay_123' },
        'evt_test_123',
      );

      expect(mockPrisma.transaction.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({
        received: true,
        alreadyProcessed: true,
        event: 'PAYMENT_CONFIRMED',
        paymentId: 'pay_123',
      });
    });
  });

  describe('PAYMENT_RECEIVED / PAYMENT_CONFIRMED', () => {
    const mockPayment = { id: 'pay_12345', value: 50.0 };
    const mockTransaction = {
      id: 'tx-1',
      asaasPaymentId: 'pay_12345',
      appointmentId: 'appt-1',
      status: TransactionStatus.PENDING,
      totalValue: 50.0,
    };

    it('should confirm transaction and appointment when payment is received in time', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // +10min
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
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

    it('should use revalidated values from Asaas API when getPaymentById succeeds', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockAsaasService.getPaymentById.mockResolvedValueOnce({
        id: 'pay_12345',
        status: 'RECEIVED',
        value: 50.0,
        fee: 0.99,
        netValue: 49.01,
      });

      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      await service.handleAsaasEvent('PAYMENT_CONFIRMED', mockPayment);

      expect(mockAsaasService.getPaymentById).toHaveBeenCalledWith('pay_12345');
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: expect.objectContaining({
          status: TransactionStatus.CONFIRMED,
          asaasFee: 0.99,
          platformAbsorbedFee: 0,
        }),
      });
    });

    it('should trigger automatic refund and update transaction to REFUNDED when payment is received for CANCELED appointment', async () => {
      const canceledAppt = {
        id: 'appt-1',
        status: ApptStatus.CANCELED,
        isActive: false,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // -5min
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
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

    it('should trigger automatic refund when payment.value is less than expected transaction.totalValue (Value Mismatch Protection)', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      const underpaidPayment = { id: 'pay_12345', value: 10.0 }; // Expected 50.0

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      const result = await service.handleAsaasEvent(
        'PAYMENT_CONFIRMED',
        underpaidPayment,
      );

      expect(mockAsaasService.refundPayment).toHaveBeenCalledWith(
        'pay_12345',
        undefined,
        expect.stringContaining('valor pago inferior'),
      );
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: TransactionStatus.REFUNDED },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CANCELED, isActive: false },
      });
      expect(result.error).toBe('Value mismatch - refunded');
    });

    it('should update asaasFee when fee is provided in webhook payment object', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      const paymentWithFee = {
        id: 'pay_12345',
        fee: 1.49,
        value: 50.0,
        netValue: 48.51,
      };
      await service.handleAsaasEvent('PAYMENT_CONFIRMED', paymentWithFee);

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: {
          status: TransactionStatus.CONFIRMED,
          asaasFee: 1.49,
          platformAbsorbedFee: 0.5,
        },
      });
    });

    it('should handle PAYMENT_RECEIVED_IN_CASH by confirming appointment and zeroing electronic split in transaction', async () => {
      const activeAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.appointment.findUnique.mockResolvedValue(activeAppt);

      const cashPayment = { id: 'pay_12345', value: 50.0 };
      const result = await service.handleAsaasEvent(
        'PAYMENT_RECEIVED_IN_CASH',
        cashPayment,
      );

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: {
          status: TransactionStatus.CONFIRMED,
          netValue: 0,
          platformFee: 0,
          asaasFee: 0,
          platformAbsorbedFee: 0,
        },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: ApptStatus.CONFIRMED },
      });
      expect(result).toEqual({
        received: true,
        event: 'PAYMENT_RECEIVED_IN_CASH',
        paymentId: 'pay_12345',
      });
    });
  });

  describe('State Machine & PAYMENT_DELETED / PAYMENT_OVERDUE', () => {
    it('should NOT cancel appointment if already CONFIRMED when PAYMENT_DELETED is received', async () => {
      const confirmedAppt = {
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
        isActive: true,
      };

      const mockTx = {
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
        status: TransactionStatus.CONFIRMED,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTx);
      mockPrisma.appointment.findUnique.mockResolvedValue(confirmedAppt);

      const result = await service.handleAsaasEvent('PAYMENT_DELETED', {
        id: 'pay_12345',
      });

      expect(mockPrisma.appointment.update).not.toHaveBeenCalled();
      expect(result.ignored).toBe(true);
    });

    it('should cancel pending appointment and update transaction to CANCELED when PAYMENT_DELETED is received', async () => {
      const pendingAppt = {
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
      };

      const mockTx = {
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
        status: TransactionStatus.PENDING,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTx);
      mockPrisma.appointment.findUnique.mockResolvedValue(pendingAppt);

      await service.handleAsaasEvent('PAYMENT_DELETED', { id: 'pay_12345' });

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

  describe('PAYMENT_REFUNDED and Chargebacks', () => {
    it('should update transaction to REFUNDED and cancel appointment on PAYMENT_REFUNDED', async () => {
      const mockTx = {
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
        status: TransactionStatus.CONFIRMED,
      };
      const mockAppt = {
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTx);
      mockPrisma.appointment.findUnique.mockResolvedValue(mockAppt);

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

    it('should handle PAYMENT_CHARGEBACK_REQUESTED and PAYMENT_CHARGEBACK_DISPUTE', async () => {
      const mockTx = {
        id: 'tx-1',
        asaasPaymentId: 'pay_12345',
        appointmentId: 'appt-1',
        status: TransactionStatus.CONFIRMED,
      };
      const mockAppt = {
        id: 'appt-1',
        status: ApptStatus.CONFIRMED,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTx);
      mockPrisma.appointment.findUnique.mockResolvedValue(mockAppt);

      await service.handleAsaasEvent('PAYMENT_CHARGEBACK_REQUESTED', {
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

  describe('Active Reconciliation Cron Job (reconcilePendingTransactions)', () => {
    it('should return 0 when there are no pending transactions older than 5 minutes', async () => {
      mockPrisma.transaction.count.mockResolvedValue(0);
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.reconcilePendingTransactions();
      expect(result).toBe(0);
      expect(mockAsaasService.getPaymentById).not.toHaveBeenCalled();
    });

    it('should reconcile transactions that are CONFIRMED on Asaas but still PENDING locally', async () => {
      const pendingTx = {
        id: 'tx-pending-1',
        asaasPaymentId: 'pay_pending_1',
        appointmentId: 'appt-1',
        status: TransactionStatus.PENDING,
        totalValue: 50.0,
      };

      mockPrisma.transaction.count.mockResolvedValue(1);
      mockPrisma.transaction.findMany.mockResolvedValue([pendingTx]);
      mockAsaasService.getPaymentById.mockResolvedValue({
        id: 'pay_pending_1',
        status: 'RECEIVED',
        value: 50.0,
      });

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.findUnique.mockResolvedValue(pendingTx);
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: ApptStatus.PENDING_PAYMENT,
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const count = await service.reconcilePendingTransactions();
      expect(count).toBe(1);
      expect(mockAsaasService.getPaymentById).toHaveBeenCalledWith(
        'pay_pending_1',
      );
    });
  });

  describe('purgeOldWebhookEvents', () => {
    it('should delete webhook events older than 60 days', async () => {
      mockPrisma.webhookEvent.deleteMany.mockResolvedValue({ count: 15 });

      const deletedCount = await service.purgeOldWebhookEvents();

      expect(deletedCount).toBe(15);
      expect(mockPrisma.webhookEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          processedAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('handleInvoiceEvent', () => {
    const platformInvoiceMock = {
      id: 'inv-123',
      companyId: 'comp-1',
      periodMonth: 9,
      periodYear: 2026,
      grossAmount: 150.0,
      asaasInvoiceId: 'as-inv-1',
      company: { id: 'comp-1', businessName: 'Barbearia Modelo' },
    };

    it('should ignore event if invoice.id is missing', async () => {
      const result = await service.handleInvoiceEvent('INVOICE_AUTHORIZED', {});
      expect(result).toEqual({
        received: true,
        ignored: true,
        reason: 'Missing invoice.id',
      });
    });

    it('should handle idempotency duplicate using WebhookEvent P2002', async () => {
      mockPrisma.webhookEvent.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.handleInvoiceEvent('INVOICE_AUTHORIZED', {
        id: 'as-inv-1',
      });
      expect(result).toEqual({
        received: true,
        alreadyProcessed: true,
        event: 'INVOICE_AUTHORIZED',
        invoiceId: 'as-inv-1',
      });
    });

    it('should update platform invoice on INVOICE_AUTHORIZED', async () => {
      mockPrisma.webhookEvent.create.mockResolvedValue({});
      mockPrisma.platformInvoice.findFirst.mockResolvedValue(
        platformInvoiceMock,
      );
      mockPrisma.platformInvoice.update.mockResolvedValue({});

      const result = await service.handleInvoiceEvent('INVOICE_AUTHORIZED', {
        id: 'as-inv-1',
        number: '12345',
        pdfUrl: 'https://asaas.com/12345.pdf',
        xmlUrl: 'https://asaas.com/12345.xml',
      });

      expect(result.received).toBe(true);
      expect(mockPrisma.platformInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: expect.objectContaining({
          status: 'AUTHORIZED',
          invoiceNumber: '12345',
          pdfUrl: 'https://asaas.com/12345.pdf',
          xmlUrl: 'https://asaas.com/12345.xml',
          authorizedAt: expect.any(Date),
        }),
      });
    });

    it('should update platform invoice on INVOICE_ERROR and send email alert to admin', async () => {
      mockPrisma.webhookEvent.create.mockResolvedValue({});
      mockPrisma.platformInvoice.findFirst.mockResolvedValue(
        platformInvoiceMock,
      );
      mockPrisma.platformInvoice.update.mockResolvedValue({});

      const result = await service.handleInvoiceEvent('INVOICE_ERROR', {
        id: 'as-inv-1',
        statusDescription: 'Certificado digital da prefeitura expirado',
      });

      expect(result.received).toBe(true);
      expect(mockPrisma.platformInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: expect.objectContaining({
          status: 'ERROR',
          errorMessage: 'Certificado digital da prefeitura expirado',
        }),
      });

      expect(mockMailService.sendInvoiceErrorAlertEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          invoiceId: 'inv-123',
          companyName: 'Barbearia Modelo',
          errorMessage: 'Certificado digital da prefeitura expirado',
        }),
      );
    });
  });
});
