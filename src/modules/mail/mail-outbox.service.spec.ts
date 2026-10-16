import { Test, TestingModule } from '@nestjs/testing';
import { MailOutboxService } from './mail-outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { EmailStatus, EmailTemplateType } from '@prisma/client';

describe('MailOutboxService', () => {
  let service: MailOutboxService;
  let prisma: PrismaService;
  let mailService: MailService;

  const mockPrismaService = {
    emailOutbox: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockMailService = {
    dispatchFromOutbox: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailOutboxService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<MailOutboxService>(MailOutboxService);
    prisma = module.get<PrismaService>(PrismaService);
    mailService = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueEmail', () => {
    it('should create an outbox record with PENDING status and nextRetryAt', async () => {
      const mockCreated = {
        id: 'outbox-uuid-1',
        to: 'cliente@test.com',
        subject: 'Boas-vindas',
        template: EmailTemplateType.WELCOME,
        payload: { name: 'Carlos' },
        status: EmailStatus.PENDING,
        attempts: 1,
        nextRetryAt: new Date(),
      };

      mockPrismaService.emailOutbox.create.mockResolvedValue(mockCreated);

      const result = await service.enqueueEmail({
        to: 'cliente@test.com',
        subject: 'Boas-vindas',
        template: EmailTemplateType.WELCOME,
        payload: { name: 'Carlos' },
        delayMinutes: 5,
        lastError: 'IP não autorizado',
      });

      expect(mockPrismaService.emailOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'cliente@test.com',
            subject: 'Boas-vindas',
            template: EmailTemplateType.WELCOME,
            status: EmailStatus.PENDING,
            attempts: 1,
            lastError: 'IP não autorizado',
          }),
        }),
      );
      expect(result).toEqual(mockCreated);
    });
  });

  describe('processPendingEmails', () => {
    it('should return 0 when there are no pending emails', async () => {
      mockPrismaService.emailOutbox.findMany.mockResolvedValue([]);

      const processed = await service.processPendingEmails();

      expect(processed).toBe(0);
      expect(mockMailService.dispatchFromOutbox).not.toHaveBeenCalled();
    });

    it('should process pending emails and mark as SENT when dispatch succeeds', async () => {
      const pendingRecord = {
        id: 'outbox-uuid-1',
        to: 'cliente@test.com',
        template: EmailTemplateType.WELCOME,
        payload: { name: 'Carlos' },
        attempts: 1,
        maxAttempts: 5,
      };

      mockPrismaService.emailOutbox.findMany.mockResolvedValue([pendingRecord]);
      mockMailService.dispatchFromOutbox.mockResolvedValue(true);
      mockPrismaService.emailOutbox.update.mockResolvedValue({
        ...pendingRecord,
        status: EmailStatus.SENT,
      });

      const processed = await service.processPendingEmails();

      expect(processed).toBe(1);
      expect(mockMailService.dispatchFromOutbox).toHaveBeenCalledWith(
        EmailTemplateType.WELCOME,
        'cliente@test.com',
        { name: 'Carlos' },
      );
      expect(mockPrismaService.emailOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-uuid-1' },
          data: expect.objectContaining({
            status: EmailStatus.SENT,
          }),
        }),
      );
    });

    it('should increment attempts and reschedule when dispatch fails', async () => {
      const pendingRecord = {
        id: 'outbox-uuid-1',
        to: 'cliente@test.com',
        template: EmailTemplateType.WELCOME,
        payload: { name: 'Carlos' },
        attempts: 1,
        maxAttempts: 5,
      };

      mockPrismaService.emailOutbox.findMany.mockResolvedValue([pendingRecord]);
      mockMailService.dispatchFromOutbox.mockResolvedValue(false);
      mockPrismaService.emailOutbox.update.mockResolvedValue({
        ...pendingRecord,
        attempts: 2,
      });

      const processed = await service.processPendingEmails();

      expect(processed).toBe(0);
      expect(mockPrismaService.emailOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-uuid-1' },
          data: expect.objectContaining({
            attempts: 2,
            status: EmailStatus.PENDING,
          }),
        }),
      );
    });

    it('should mark as FAILED (Dead Letter) when maxAttempts is reached', async () => {
      const pendingRecord = {
        id: 'outbox-uuid-1',
        to: 'cliente@test.com',
        template: EmailTemplateType.WELCOME,
        payload: { name: 'Carlos' },
        attempts: 4,
        maxAttempts: 5,
      };

      mockPrismaService.emailOutbox.findMany.mockResolvedValue([pendingRecord]);
      mockMailService.dispatchFromOutbox.mockResolvedValue(false);
      mockPrismaService.emailOutbox.update.mockResolvedValue({
        ...pendingRecord,
        attempts: 5,
        status: EmailStatus.FAILED,
      });

      const processed = await service.processPendingEmails();

      expect(processed).toBe(0);
      expect(mockPrismaService.emailOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-uuid-1' },
          data: expect.objectContaining({
            attempts: 5,
            status: EmailStatus.FAILED,
          }),
        }),
      );
    });
  });

  describe('purgeOldEmails', () => {
    it('should delete SENT emails older than 7 days and FAILED emails older than 30 days', async () => {
      mockPrismaService.emailOutbox.deleteMany
        .mockResolvedValueOnce({ count: 15 })
        .mockResolvedValueOnce({ count: 2 });

      const result = await service.purgeOldEmails();

      expect(result).toEqual({ purgedSent: 15, purgedFailed: 2 });
      expect(mockPrismaService.emailOutbox.deleteMany).toHaveBeenCalledTimes(2);
    });
  });
});
