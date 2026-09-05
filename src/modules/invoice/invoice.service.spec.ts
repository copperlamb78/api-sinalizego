import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import { MailService } from 'src/modules/mail/mail.service';
import { NotFoundException } from '@nestjs/common';
import {
  ApptStatus,
  PlatformInvoiceStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: PrismaService;
  let asaasService: AsaasService;
  let mailService: MailService;

  const mockPrismaService = {
    company: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    platformInvoice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockAsaasService = {
    createCustomerInMasterAccount: jest.fn(),
    scheduleInvoice: jest.fn(),
    getInvoiceById: jest.fn(),
  };

  const mockMailService = {
    sendInvoiceErrorAlertEmail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AsaasService, useValue: mockAsaasService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasService = module.get<AsaasService>(AsaasService);
    mailService = module.get<MailService>(MailService);

    jest.clearAllMocks();
  });

  describe('consolidateAndScheduleMonthlyInvoices', () => {
    const companyMock = {
      id: 'comp-1',
      businessName: 'Barbearia Vintage',
      platformCustomerId: 'cus_master_123',
      owner: { id: 'usr-1', name: 'João Dono', cpfCnpj: '12345678900' },
      financialProfile: { id: 'fp-1', cpfCnpj: '12345678900' },
    };

    it('deve consolidar taxa bruta acumulada e agendar NFS-e no Asaas', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([companyMock]);
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue(null);

      mockPrismaService.appointment.findMany.mockResolvedValue([
        { id: 'appt-1', platformFeeAmount: 2.5 },
        { id: 'appt-2', platformFeeAmount: 3.0 },
      ]);

      const createdInvoiceMock = {
        id: 'inv-uuid-1',
        companyId: 'comp-1',
        periodMonth: 9,
        periodYear: 2026,
        grossAmount: 5.5,
        appointmentsCount: 2,
        status: PlatformInvoiceStatus.SCHEDULED,
      };

      mockPrismaService.platformInvoice.create.mockResolvedValue(
        createdInvoiceMock,
      );
      mockPrismaService.appointment.updateMany.mockResolvedValue({ count: 2 });

      mockAsaasService.scheduleInvoice.mockResolvedValue({
        id: 'asaas-inv-123',
        status: 'SCHEDULED',
        pdfUrl: 'https://asaas.com/invoice.pdf',
        xmlUrl: 'https://asaas.com/invoice.xml',
      });

      mockPrismaService.platformInvoice.update.mockResolvedValue({
        ...createdInvoiceMock,
        asaasInvoiceId: 'asaas-inv-123',
      });

      const result = await service.consolidateAndScheduleMonthlyInvoices(
        2026,
        9,
      );

      expect(result.processedCompanies).toBe(1);
      expect(result.invoicesCreated).toBe(1);
      expect(result.totalGrossAmount).toBe(5.5);

      expect(mockAsaasService.scheduleInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cus_master_123',
          value: 5.5,
          externalReference: 'inv-uuid-1',
        }),
      );

      expect(mockPrismaService.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['appt-1', 'appt-2'] } },
        data: { platformInvoiceId: 'inv-uuid-1' },
      });
    });

    it('deve respeitar a idempotência e não faturar duas vezes a mesma competência', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([companyMock]);
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue({
        id: 'inv-existing',
      });

      const result = await service.consolidateAndScheduleMonthlyInvoices(
        2026,
        9,
      );

      expect(result.invoicesCreated).toBe(0);
      expect(mockPrismaService.appointment.findMany).not.toHaveBeenCalled();
      expect(mockAsaasService.scheduleInvoice).not.toHaveBeenCalled();
    });

    it('deve emitir NFS-e mesmo para valores baixos (ex: R$ 2,50) sem piso de acumulação', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([companyMock]);
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue(null);

      mockPrismaService.appointment.findMany.mockResolvedValue([
        { id: 'appt-single', platformFeeAmount: 2.5 },
      ]);

      mockPrismaService.platformInvoice.create.mockResolvedValue({
        id: 'inv-single',
        grossAmount: 2.5,
      });

      mockAsaasService.scheduleInvoice.mockResolvedValue({
        id: 'asaas-single',
        status: 'SCHEDULED',
      });

      const result = await service.consolidateAndScheduleMonthlyInvoices(
        2026,
        9,
      );

      expect(result.invoicesCreated).toBe(1);
      expect(result.totalGrossAmount).toBe(2.5);
      expect(mockAsaasService.scheduleInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ value: 2.5 }),
      );
    });

    it('não deve emitir NFS-e se o valor acumulado for zero ou não houver agendamentos', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([companyMock]);
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue(null);
      mockPrismaService.appointment.findMany.mockResolvedValue([]);

      const result = await service.consolidateAndScheduleMonthlyInvoices(
        2026,
        9,
      );

      expect(result.invoicesCreated).toBe(0);
      expect(result.totalGrossAmount).toBe(0);
      expect(mockAsaasService.scheduleInvoice).not.toHaveBeenCalled();
    });

    it('deve criar platformCustomerId sob demanda se empresa ainda não possuir cadastro', async () => {
      const companyWithoutCustomer = {
        ...companyMock,
        platformCustomerId: null,
      };

      mockPrismaService.company.findMany.mockResolvedValue([
        companyWithoutCustomer,
      ]);
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue(null);
      mockPrismaService.appointment.findMany.mockResolvedValue([
        { id: 'appt-1', platformFeeAmount: 10.0 },
      ]);

      mockAsaasService.createCustomerInMasterAccount.mockResolvedValue(
        'cus_newly_created',
      );
      mockPrismaService.company.update.mockResolvedValue({});
      mockPrismaService.platformInvoice.create.mockResolvedValue({
        id: 'inv-lazy',
        grossAmount: 10.0,
      });
      mockAsaasService.scheduleInvoice.mockResolvedValue({ id: 'as-1' });

      await service.consolidateAndScheduleMonthlyInvoices(2026, 9);

      expect(
        mockAsaasService.createCustomerInMasterAccount,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          cpfCnpj: '12345678900',
        }),
      );
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { platformCustomerId: 'cus_newly_created' },
      });
    });

    it('deve marcar PlatformInvoice como ERROR e disparar e-mail de alerta ao admin se o Asaas falhar', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([companyMock]);
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue(null);
      mockPrismaService.appointment.findMany.mockResolvedValue([
        { id: 'appt-1', platformFeeAmount: 15.0 },
      ]);

      mockPrismaService.platformInvoice.create.mockResolvedValue({
        id: 'inv-err-1',
        grossAmount: 15.0,
      });
      mockPrismaService.appointment.updateMany.mockResolvedValue({ count: 1 });

      mockAsaasService.scheduleInvoice.mockRejectedValue(
        new Error('Inscrição municipal inválida no Asaas'),
      );

      await service.consolidateAndScheduleMonthlyInvoices(2026, 9);

      expect(mockPrismaService.platformInvoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-err-1' },
        data: {
          status: PlatformInvoiceStatus.ERROR,
          errorMessage: 'Inscrição municipal inválida no Asaas',
        },
      });

      expect(mockMailService.sendInvoiceErrorAlertEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          invoiceId: 'inv-err-1',
          companyName: 'Barbearia Vintage',
          errorMessage: 'Inscrição municipal inválida no Asaas',
        }),
      );
    });
  });

  describe('getCompanyInvoices', () => {
    it('deve retornar lista paginada de NFS-e da empresa', async () => {
      mockPrismaService.company.findFirst.mockResolvedValue({
        id: 'comp-1',
        businessName: 'Barbearia X',
      });
      mockPrismaService.platformInvoice.findMany.mockResolvedValue([
        { id: 'inv-1', grossAmount: 100, periodMonth: 9, periodYear: 2026 },
      ]);
      mockPrismaService.platformInvoice.count.mockResolvedValue(1);

      const result = await service.getCompanyInvoices('usr-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('deve lançar NotFoundException se o usuário não possuir a empresa', async () => {
      mockPrismaService.company.findFirst.mockResolvedValue(null);

      await expect(
        service.getCompanyInvoices('usr-intruder', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAdminInvoices', () => {
    it('deve retornar lista paginada de NFS-e para o admin', async () => {
      mockPrismaService.platformInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-admin-1',
          grossAmount: 250,
          company: { id: 'c-1', businessName: 'Barbearia Top' },
        },
      ]);
      mockPrismaService.platformInvoice.count.mockResolvedValue(1);

      const result = await service.getAdminInvoices({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getInvoiceAppointments (Extrato)', () => {
    it('deve retornar agendamentos associados a uma nota fiscal', async () => {
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        company: {
          id: 'comp-1',
          userId: 'usr-owner',
          businessName: 'Barbearia 1',
        },
        periodMonth: 9,
        periodYear: 2026,
        grossAmount: 50,
        appointmentsCount: 2,
      });

      mockPrismaService.appointment.findMany.mockResolvedValue([
        { id: 'a1', platformFeeAmount: 25 },
        { id: 'a2', platformFeeAmount: 25 },
      ]);

      const result = await service.getInvoiceAppointments(
        'inv-1',
        'usr-owner',
        false,
      );

      expect(result.appointments).toHaveLength(2);
      expect(result.invoice.id).toBe('inv-1');
    });

    it('deve impedir acesso de usuário que não seja dono nem admin', async () => {
      mockPrismaService.platformInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        company: { id: 'comp-1', userId: 'usr-owner' },
      });

      await expect(
        service.getInvoiceAppointments('inv-1', 'usr-stranger', false),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
