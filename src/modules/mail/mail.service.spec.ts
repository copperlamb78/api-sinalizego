import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';

// Mock the brevo module
const mockSendTransacEmail = jest.fn();

jest.mock('@getbrevo/brevo', () => {
  return {
    BrevoClient: jest.fn().mockImplementation(() => ({
      transactionalEmails: {
        sendTransacEmail: mockSendTransacEmail,
      },
    })),
  };
});

describe('MailService', () => {
  let service: MailService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BREVO_API_KEY') return 'test-brevo-api-key';
      if (key === 'MAIL_FROM_EMAIL') return 'test@sinalizego.com';
      if (key === 'MAIL_FROM_NAME') return 'SinalizeGo Test';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email via BrevoClient', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-123' });

      const result = await service.sendPasswordResetEmail(
        'cliente@test.com',
        'Cliente Teste',
        'http://localhost:3000/reset-password?token=test-token',
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Redefinição de Senha — SinalizeGo',
          to: [{ email: 'cliente@test.com', name: 'Cliente Teste' }],
        }),
      );
      expect(result).toBe(true);
    });

    it('should return false without throwing when Brevo api fails', async () => {
      mockSendTransacEmail.mockRejectedValue(
        new Error('Brevo API network failure'),
      );

      const result = await service.sendPasswordResetEmail(
        'cliente@test.com',
        'Cliente Teste',
        'http://localhost:3000/reset-password?token=test-token',
      );

      expect(mockSendTransacEmail).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
