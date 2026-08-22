import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: TransactionsService;

  const mockTransactionsService = {
    createPixForAppointment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPix', () => {
    it('should call createPixForAppointment with appointmentId and userId from JWT', async () => {
      const req = { user: { sub: 'client-1' } } as any;
      const appointmentId = 'appointment-123';
      const expected = {
        paymentId: 'pay_12345',
        totalValue: 50.0,
        qrCodePayload: '00020126580014BR.GOV.BCB.PIX...',
        qrCodeImage: 'data:image/png;base64,...',
        expirationDate: new Date(),
        barberNetValue: 49.01,
        platformFee: 2.0,
        asaasFee: 0.99,
      };

      mockTransactionsService.createPixForAppointment.mockResolvedValue(
        expected,
      );

      const result = await controller.createPix(appointmentId, req);
      expect(service.createPixForAppointment).toHaveBeenCalledWith(
        'appointment-123',
        'client-1',
      );
      expect(result).toEqual(expected);
    });
  });
});
