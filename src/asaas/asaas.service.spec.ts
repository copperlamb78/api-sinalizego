import { Test, TestingModule } from '@nestjs/testing';
import { AsaasService } from './asaas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculateTax } from 'src/helpers/calculate-tax.helper';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BARBER_ASAAS_PIX_FEE } from 'src/common/constants/billing.constant';
import { CryptoHelper } from 'src/helpers/crypto.helper';

describe('AsaasService', () => {
  let service: AsaasService;
  let prisma: PrismaService;
  let calculateTax: CalculateTax;

  const mockPrisma = {
    financialProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockCalculateTax = {
    calculatePlatformTax: jest.fn().mockReturnValue(2.0),
  };

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.restoreAllMocks();
    process.env = {
      ...originalEnv,
      ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
      ASAAS_API_KEY: 'test_api_key',
      ENCRYPTION_SECRET: 'test-secret',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsaasService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CalculateTax,
          useValue: mockCalculateTax,
        },
      ],
    }).compile();

    service = module.get<AsaasService>(AsaasService);
    prisma = module.get<PrismaService>(PrismaService);
    calculateTax = module.get<CalculateTax>(CalculateTax);

    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Initialization and Dynamic Fee Discovery', () => {
    it('should initialize with DEFAULT_ASAAS_GATEWAY_COST fallback', () => {
      expect(service.asaasPixFee).toBe(0.99);
    });

    it('should dynamically update fee during onModuleInit from fetchAccountFees', async () => {
      jest.spyOn(service, 'fetchAccountFees').mockResolvedValue({
        payment: {
          pix: {
            fixedFeeValueWithDiscount: 1.49,
          },
        },
      });

      await service.onModuleInit();
      expect(service.asaasPixFee).toBe(1.49);
    });

    it('should maintain fallback fee when fetchAccountFees returns null or fails', async () => {
      const instance = new AsaasService(
        mockPrisma as any,
        mockCalculateTax as any,
      );
      jest.spyOn(instance, 'fetchAccountFees').mockResolvedValue(null);

      await instance.onModuleInit();
      expect(instance.asaasPixFee).toBe(0.99);
    });
  });

  describe('createPixChargeWithSplit', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create pix charge with split, calculating barber net value and returning real fee from Asaas response', async () => {
      const mockPaymentResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'pay_test_123',
          value: 22.0,
          netValue: 20.51,
          fee: 1.49,
        }),
      };

      const mockQrCodeResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          encodedImage: 'base64image',
          payload: 'pix_payload_123',
          expirationDate: new Date('2026-08-22T12:00:00Z'),
        }),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockPaymentResponse as any)
        .mockResolvedValueOnce(mockQrCodeResponse as any);

      const result = await service.createPixChargeWithSplit(
        'cus_123',
        'wallet_barber_123',
        20.0,
        'appt-1',
        2.0,
      );

      expect(result).toEqual({
        paymentId: 'pay_test_123',
        totalValue: 22.0,
        qrCodePayload: 'pix_payload_123',
        qrCodeImage: 'base64image',
        expirationDate: new Date('2026-08-22T12:00:00Z'),
        barberNetValue: 19.01, // 20.00 - 0.99
        platformFee: 2.0,
        asaasFee: 1.49, // real fee returned by Asaas
      });
    });

    it('should fallback asaasFee to value - netValue when fee field is missing in payment response', async () => {
      const mockPaymentResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'pay_test_456',
          value: 30.0,
          netValue: 28.01,
        }),
      };

      const mockQrCodeResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          encodedImage: 'base64image',
          payload: 'pix_payload_456',
          expirationDate: new Date('2026-08-22T12:00:00Z'),
        }),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockPaymentResponse as any)
        .mockResolvedValueOnce(mockQrCodeResponse as any);

      const result = await service.createPixChargeWithSplit(
        'cus_123',
        'wallet_barber_123',
        25.0,
        'appt-2',
        5.0,
      );

      expect(result.asaasFee).toBe(1.99); // 30.00 - 28.01
    });

    it('should throw BadRequestException if Asaas payment creation returns an error', async () => {
      const mockErrorResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          errors: [{ description: 'Cliente inválido' }],
        }),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockErrorResponse as any);

      await expect(
        service.createPixChargeWithSplit(
          'cus_invalid',
          'wallet_123',
          20.0,
          'appt-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPixQrCode', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return QR Code data for valid paymentId', async () => {
      const mockQrResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          encodedImage: 'img_base64',
          payload: 'payload_string',
          expirationDate: new Date('2026-08-22T12:00:00Z'),
        }),
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockQrResponse as any);

      const result = await service.getPixQrCode('pay_123');
      expect(result).toEqual({
        qrCodePayload: 'payload_string',
        qrCodeImage: 'img_base64',
        expirationDate: new Date('2026-08-22T12:00:00Z'),
      });
    });

    it('should throw BadRequestException if Asaas QR code fetch fails', async () => {
      const mockErrorResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          errors: [{ description: 'Cobrança não encontrada' }],
        }),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockErrorResponse as any);

      await expect(service.getPixQrCode('pay_unknown')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createCustomer', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create customer and return customerId', async () => {
      const mockCustomerResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'cus_new_123' }),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockCustomerResponse as any);

      const result = await service.createCustomer(
        '12345678901',
        'Cliente Teste',
      );
      expect(result).toBe('cus_new_123');
    });

    it('should throw BadRequestException if customer creation fails', async () => {
      const mockErrorResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          errors: [{ description: 'CPF inválido' }],
        }),
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockErrorResponse as any);

      await expect(
        service.createCustomer('invalid_cpf', 'Teste'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPayment', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return true when Asaas deletes payment successfully', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true } as any);
      const result = await service.cancelPayment('pay_123');
      expect(result).toBe(true);
    });

    it('should throw InternalServerErrorException when Asaas deletion fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ errors: [] }),
      } as any);
      await expect(service.cancelPayment('pay_123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('refundPayment', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return true when refund succeeds', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true } as any);
      const result = await service.refundPayment('pay_123', 20.0, 'Estorno');
      expect(result).toBe(true);
    });

    it('should throw InternalServerErrorException when refund request fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ errors: [] }),
      } as any);
      await expect(service.refundPayment('pay_123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('listSubAccountById', () => {
    it('should fetch subaccount and sanitize apiKey from returned object', async () => {
      const mockAsaasResponse = {
        id: 'acc_123',
        name: 'Barbearia VIP',
        email: 'barber@vip.com',
        apiKey: 'secret_live_api_key',
        walletId: 'wal_123',
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAsaasResponse),
      } as any);

      const result = await service.listSubAccountById('acc_123');

      expect(result.id).toBe('acc_123');
      expect(result).not.toHaveProperty('apiKey');
    });
  });

  describe('getSubacccountBalance', () => {
    it('should throw NotFoundException if financial profile is not found', async () => {
      mockPrisma.financialProfile.findFirst.mockResolvedValue(null);

      await expect(
        service.getSubacccountBalance('wallet_123', 'user_123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if asaasApiKey is missing', async () => {
      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        walletId: 'wallet_123',
        userId: 'user_123',
        asaasApiKey: null,
      });

      await expect(
        service.getSubacccountBalance('wallet_123', 'user_123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should decrypt asaasApiKey and fetch balance successfully', async () => {
      const encryptedKey = CryptoHelper.encrypt('raw_api_key_123');
      mockPrisma.financialProfile.findFirst.mockResolvedValue({
        walletId: 'wallet_123',
        userId: 'user_123',
        asaasApiKey: encryptedKey,
      });

      const mockBalance = { balance: 1500.5 };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockBalance),
      } as any);

      const result = await service.getSubacccountBalance(
        'wallet_123',
        'user_123',
      );
      expect(result).toEqual(mockBalance);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/finance/balance'),
        expect.objectContaining({
          headers: expect.objectContaining({
            access_token: 'raw_api_key_123',
          }),
        }),
      );
    });
  });

  describe('getPaymentById', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return payment data when found', async () => {
      const mockPayment = { id: 'pay_123', status: 'RECEIVED', value: 50.0 };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPayment),
      } as any);

      const result = await service.getPaymentById('pay_123');
      expect(result).toEqual(mockPayment);
    });

    it('should return null when fetch fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ errors: [] }),
      } as any);

      const result = await service.getPaymentById('pay_invalid');
      expect(result).toBeNull();
    });
  });
});
