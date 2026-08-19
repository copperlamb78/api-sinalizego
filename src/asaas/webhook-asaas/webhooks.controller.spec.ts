import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { AsaasWebhookGuard } from './guard/asaas-webhook.guard';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: WebhooksService;

  const mockWebhooksService = {
    handleAsaasEvent: jest.fn(),
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

  describe('handleAsaasWebhook', () => {
    it('should return received: true if payment.id is not present', async () => {
      const result = await controller.handleAsaasWebhook({ event: 'TEST' });
      expect(result).toEqual({ received: true });
      expect(service.handleAsaasEvent).not.toHaveBeenCalled();
    });

    it('should delegate to webhooksService.handleAsaasEvent when payment.id is present', async () => {
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_12345' },
      };
      const expected = { received: true, event: 'PAYMENT_CONFIRMED', paymentId: 'pay_12345' };
      mockWebhooksService.handleAsaasEvent.mockResolvedValue(expected);

      const result = await controller.handleAsaasWebhook(payload);
      expect(service.handleAsaasEvent).toHaveBeenCalledWith('PAYMENT_CONFIRMED', { id: 'pay_12345' });
      expect(result).toEqual(expected);
    });
  });
});
