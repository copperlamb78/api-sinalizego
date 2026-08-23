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

  describe('sendWelcomeEmail', () => {
    it('should send welcome email to new user', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-welcome-1' });

      const result = await service.sendWelcomeEmail(
        'cliente@test.com',
        'Carlos Silva',
        'CLIENT',
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Boas-vindas ao SinalizeGo! 🚀',
          to: [{ email: 'cliente@test.com', name: 'Carlos Silva' }],
        }),
      );
      expect(result).toBe(true);
    });

    it('should catch error and return false when Brevo fails', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Network error'));

      const result = await service.sendWelcomeEmail(
        'cliente@test.com',
        'Carlos Silva',
      );

      expect(result).toBe(false);
    });
  });

  describe('sendAppointmentConfirmationEmail', () => {
    it('should send appointment confirmation email', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-conf-1' });

      const result = await service.sendAppointmentConfirmationEmail(
        'cliente@test.com',
        {
          customerName: 'Carlos Silva',
          companyName: 'Barbearia VIP',
          serviceName: 'Corte Degradê',
          appointmentDate: new Date('2026-08-25T14:00:00Z'),
          amountPaid: 35.0,
          timezone: 'America/Sao_Paulo',
        },
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Agendamento Confirmado — Barbearia VIP 🎉',
          to: [{ email: 'cliente@test.com', name: 'Carlos Silva' }],
        }),
      );
      expect(result).toBe(true);
    });

    it('should return false on Brevo failure', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Brevo failure'));

      const result = await service.sendAppointmentConfirmationEmail(
        'cliente@test.com',
        {
          customerName: 'Carlos Silva',
          companyName: 'Barbearia VIP',
          serviceName: 'Corte',
          appointmentDate: new Date(),
          amountPaid: 20.0,
        },
      );

      expect(result).toBe(false);
    });
  });

  describe('sendAppointmentCancellationEmail', () => {
    it('should send cancellation email with refund notice', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-cancel-1' });

      const result = await service.sendAppointmentCancellationEmail(
        'cliente@test.com',
        {
          customerName: 'Carlos Silva',
          companyName: 'Barbearia VIP',
          serviceName: 'Corte Degradê',
          appointmentDate: new Date('2026-08-25T14:00:00Z'),
          isRefunded: true,
        },
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Agendamento Cancelado — Barbearia VIP',
          to: [{ email: 'cliente@test.com', name: 'Carlos Silva' }],
        }),
      );
      expect(result).toBe(true);
    });

    it('should send cancellation email without refund notice when within 24h', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-cancel-2' });

      const result = await service.sendAppointmentCancellationEmail(
        'cliente@test.com',
        {
          customerName: 'Carlos Silva',
          companyName: 'Barbearia VIP',
          serviceName: 'Corte Degradê',
          appointmentDate: new Date('2026-08-25T14:00:00Z'),
          isRefunded: false,
        },
      );

      expect(result).toBe(true);
    });
  });

  describe('sendAppointmentReminderEmail', () => {
    it('should send D-1 appointment reminder email', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-rem-1' });

      const result = await service.sendAppointmentReminderEmail(
        'cliente@test.com',
        {
          customerName: 'Carlos Silva',
          companyName: 'Barbearia VIP',
          serviceName: 'Corte Degradê',
          appointmentDate: new Date('2026-08-25T14:00:00Z'),
          address: 'Rua Principal, 100 - Centro, Feira de Santana/BA',
        },
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Lembrete: Seu agendamento é amanhã! ⏰ — Barbearia VIP',
          to: [{ email: 'cliente@test.com', name: 'Carlos Silva' }],
        }),
      );
      expect(result).toBe(true);
    });
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
