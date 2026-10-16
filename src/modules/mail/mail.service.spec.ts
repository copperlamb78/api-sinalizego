import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import { MailOutboxService } from './mail-outbox.service';
import { EmailTemplateType } from '@prisma/client';

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
  let outboxService: MailOutboxService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BREVO_API_KEY') return 'test-brevo-api-key';
      if (key === 'MAIL_FROM_EMAIL') return 'test@sinalizego.com';
      if (key === 'MAIL_FROM_NAME') return 'SinalizeGo Test';
      if (key === 'NODE_ENV') return 'test';
      return null;
    }),
  };

  const mockMailOutboxService = {
    enqueueEmail: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
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
        {
          provide: MailOutboxService,
          useValue: mockMailOutboxService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    outboxService = module.get<MailOutboxService>(MailOutboxService);
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
      expect(mockMailOutboxService.enqueueEmail).not.toHaveBeenCalled();
    });

    it('should catch error, enqueue in outbox and return false when Brevo fails', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Network error'));

      const result = await service.sendWelcomeEmail(
        'cliente@test.com',
        'Carlos Silva',
      );

      expect(result).toBe(false);
      expect(mockMailOutboxService.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cliente@test.com',
          template: EmailTemplateType.WELCOME,
        }),
      );
    });

    it('should detect 401 unrecognised IP error and enqueue with 5 min delay without micro-retrying', async () => {
      const error401 = new Error('unrecognised IP address 181.216.222.191');
      (error401 as any).status = 401;
      mockSendTransacEmail.mockRejectedValue(error401);

      const result = await service.sendWelcomeEmail(
        'eray2739@uorak.com',
        'Novo Usuário',
      );

      expect(result).toBe(false);
      // Fail-fast: deve chamar apenas 1 vez (sem micro-retries imediatos)
      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
      expect(mockMailOutboxService.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'eray2739@uorak.com',
          template: EmailTemplateType.WELCOME,
          delayMinutes: 5,
        }),
      );
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

    it('should return false and enqueue in outbox on Brevo failure', async () => {
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
      expect(mockMailOutboxService.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cliente@test.com',
          template: EmailTemplateType.APPOINTMENT_CONFIRMATION,
        }),
      );
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
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email via BrevoClient', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-pwd-1' });

      const result = await service.sendPasswordResetEmail(
        'cliente@test.com',
        'Carlos Silva',
        'https://app.sinalizego.com/reset?token=xyz',
      );

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Redefinição de Senha — SinalizeGo',
          to: [{ email: 'cliente@test.com', name: 'Carlos Silva' }],
        }),
      );
      expect(result).toBe(true);
    });
  });

  describe('dispatchFromOutbox', () => {
    it('should dispatch welcome email from outbox payload', async () => {
      mockSendTransacEmail.mockResolvedValue({ messageId: 'msg-outbox-1' });

      const success = await service.dispatchFromOutbox(
        EmailTemplateType.WELCOME,
        'novo@test.com',
        { name: 'Novo Cliente', role: 'CLIENT' },
      );

      expect(success).toBe(true);
      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: [{ email: 'novo@test.com', name: 'Novo Cliente' }],
        }),
      );
    });

    it('should return false if dispatchFromOutbox encounters an error without throwing', async () => {
      mockSendTransacEmail.mockRejectedValue(new Error('Simulated failure'));

      const success = await service.dispatchFromOutbox(
        EmailTemplateType.WELCOME,
        'novo@test.com',
        { name: 'Novo Cliente' },
      );

      expect(success).toBe(false);
    });
  });
});
