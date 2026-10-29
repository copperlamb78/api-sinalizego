import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { AsaasWebhookGuard } from './guard/asaas-webhook.guard';
import { PATH_METADATA } from '@nestjs/common/constants';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  const mockWebhooksService = {
    handleAsaasEvent: jest.fn(),
    handleInvoiceEvent: jest.fn(),
    handleAccountStatusEvent: jest.fn(),
  };

  const mockAsaasWebhookGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
      ],
    })
      .overrideGuard(AsaasWebhookGuard)
      .useValue(mockAsaasWebhookGuard)
      .compile();

    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should bind both canonical "webhooks" and redundant "api/v1/webhooks" route prefixes', () => {
    const paths = Reflect.getMetadata(PATH_METADATA, WebhooksController);
    expect(paths).toEqual(['webhooks', 'api/v1/webhooks']);
  });

  describe('handleAsaasWebhook', () => {
    it('should return received: true if payment.id is not present on standard event', async () => {
      const result = await controller.handleAsaasWebhook({ event: 'TEST' });
      expect(result).toEqual({ received: true });
      expect(service.handleAsaasEvent).not.toHaveBeenCalled();
    });

    it('should delegate to webhooksService.handleAsaasEvent when payment.id is present', async () => {
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_12345' },
      };
      const expected = {
        received: true,
        event: 'PAYMENT_CONFIRMED',
        paymentId: 'pay_12345',
      };
      mockWebhooksService.handleAsaasEvent.mockResolvedValue(expected);

      const result = await controller.handleAsaasWebhook(payload);
      expect(service.handleAsaasEvent).toHaveBeenCalledWith(
        'PAYMENT_CONFIRMED',
        { id: 'pay_12345' },
        undefined,
        payload,
      );
      expect(result).toEqual(expected);
    });

    it('should delegate to handleInvoiceEvent when event starts with INVOICE_', async () => {
      const payload = {
        event: 'INVOICE_AUTHORIZED',
        invoice: { id: 'inv_123' },
      };
      const expected = { received: true, invoice: 'authorized' };
      mockWebhooksService.handleInvoiceEvent.mockResolvedValue(expected);

      const result = await controller.handleAsaasWebhook(payload);
      expect(service.handleInvoiceEvent).toHaveBeenCalledWith(
        'INVOICE_AUTHORIZED',
        { id: 'inv_123' },
        undefined,
        payload,
      );
      expect(result).toEqual(expected);
    });

    it('should return ignored when INVOICE_ event is missing invoice.id', async () => {
      const payload = {
        event: 'INVOICE_AUTHORIZED',
      };

      const result = await controller.handleAsaasWebhook(payload);
      expect(result).toEqual({
        received: true,
        ignored: true,
        reason: 'Missing invoice.id',
      });
      expect(service.handleInvoiceEvent).not.toHaveBeenCalled();
    });

    it('should delegate to handleAccountStatusEvent when event starts with ACCOUNT_STATUS_', async () => {
      const payload = {
        event: 'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED',
      };
      const expected = { received: true, status: 'approved' };
      mockWebhooksService.handleAccountStatusEvent.mockResolvedValue(expected);

      const result = await controller.handleAsaasWebhook(payload);
      expect(service.handleAccountStatusEvent).toHaveBeenCalledWith(
        'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED',
        payload,
        undefined,
      );
      expect(result).toEqual(expected);
    });

    it('should catch unhandled errors and return fail-safe 200 response (Regra Crítica A21)', async () => {
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_error' },
      };
      mockWebhooksService.handleAsaasEvent.mockRejectedValue(
        new Error('Database lock timeout'),
      );

      const result = await controller.handleAsaasWebhook(payload);
      expect(result).toEqual({
        received: true,
        error: true,
        message: 'Processed with error recovery',
      });
    });
  });
});
