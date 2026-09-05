import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { WebhooksService } from '../src/asaas/webhook-asaas/webhooks.service';
import { JwtService } from '@nestjs/jwt';
import { Role, PlatformInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Invoice & Webhook HTTP Request Test (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockInvoiceService = {
    getCompanyInvoices: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-123',
          companyId: 'comp-1',
          referenceMonth: 8,
          referenceYear: 2026,
          grossFeeAmount: 250.0,
          status: PlatformInvoiceStatus.AUTHORIZED,
          pdfUrl: 'https://asaas.com/pdf/inv-123',
          xmlUrl: 'https://asaas.com/xml/inv-123',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    }),
    getInvoiceAppointments: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'apt-1',
          companyId: 'comp-1',
          servicePrice: 50.0,
          platformFeeAmount: 2.5,
          status: 'COMPLETED',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    getAdminInvoices: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-admin-1',
          companyId: 'comp-1',
          referenceMonth: 8,
          referenceYear: 2026,
          grossFeeAmount: 500.0,
          status: PlatformInvoiceStatus.SYNCHRONIZED,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    }),
  };

  const mockWebhooksService = {
    handleInvoiceEvent: jest.fn().mockImplementation((event, invoice) => {
      return Promise.resolve({
        received: true,
        event,
        invoiceId: invoice.id,
        platformInvoiceId: 'inv-123',
        status: event === 'INVOICE_AUTHORIZED' ? 'AUTHORIZED' : 'ERROR',
      });
    }),
    handlePaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    handlePaymentReceived: jest.fn().mockResolvedValue(undefined),
    handlePaymentRefunded: jest.fn().mockResolvedValue(undefined),
    handlePaymentOverdue: jest.fn().mockResolvedValue(undefined),
    handleTransferEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'user-owner-1') {
          return Promise.resolve({
            id: 'user-owner-1',
            email: 'owner@sinalizego.com',
            role: Role.COMPANY_OWNER,
            isActive: true,
          });
        }
        if (where.id === 'user-client-1') {
          return Promise.resolve({
            id: 'user-client-1',
            email: 'client@sinalizego.com',
            role: Role.CLIENT,
            isActive: true,
          });
        }
        if (where.id === 'user-admin-1') {
          return Promise.resolve({
            id: 'user-admin-1',
            email: 'admin@sinalizego.com',
            role: Role.ADMIN,
            isActive: true,
          });
        }
        return Promise.resolve(null);
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(InvoiceService)
      .useValue(mockInvoiceService)
      .overrideProvider(WebhooksService)
      .useValue(mockWebhooksService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function createToken(payload: { sub: string; email: string; role: Role }) {
    return jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'test_jwt_secret',
    });
  }

  describe('GET /company/invoices', () => {
    it('deve retornar 401 Unauthorized se requisição for feita sem token JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/company/invoices')
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('deve retornar 403 Forbidden se um usuário CLIENT tentar acessar rota da empresa', async () => {
      const token = createToken({
        sub: 'user-client-1',
        email: 'client@sinalizego.com',
        role: Role.CLIENT,
      });

      await request(app.getHttpServer())
        .get('/company/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('deve retornar 200 OK com lista de notas fiscais para usuário autenticado (COMPANY_OWNER)', async () => {
      const token = createToken({
        sub: 'user-owner-1',
        email: 'owner@sinalizego.com',
        role: Role.COMPANY_OWNER,
      });

      const res = await request(app.getHttpServer())
        .get(
          '/company/invoices?page=1&limit=10&status=AUTHORIZED&year=2026&month=8',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('inv-123');
      expect(res.body.data[0].grossFeeAmount).toBe(250.0);
      expect(mockInvoiceService.getCompanyInvoices).toHaveBeenCalledWith(
        'user-owner-1',
        expect.objectContaining({
          page: 1,
          limit: 10,
          status: PlatformInvoiceStatus.AUTHORIZED,
          year: 2026,
          month: 8,
        }),
      );
    });

    it('deve retornar 400 Bad Request se status informado no query for inválido', async () => {
      const token = createToken({
        sub: 'user-owner-1',
        email: 'owner@sinalizego.com',
        role: Role.COMPANY_OWNER,
      });

      await request(app.getHttpServer())
        .get('/company/invoices?status=STATUS_INEXISTENTE')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('GET /company/invoices/:id/appointments', () => {
    it('deve retornar 200 OK com os agendamentos que compõem a NFS-e', async () => {
      const token = createToken({
        sub: 'user-owner-1',
        email: 'owner@sinalizego.com',
        role: Role.COMPANY_OWNER,
      });

      const res = await request(app.getHttpServer())
        .get('/company/invoices/inv-123/appointments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('apt-1');
      expect(mockInvoiceService.getInvoiceAppointments).toHaveBeenCalledWith(
        'inv-123',
        'user-owner-1',
        false,
      );
    });
  });

  describe('GET /admin/invoices (RBAC)', () => {
    it('deve retornar 403 Forbidden se um usuário com papel COMPANY_OWNER tentar acessar rota de ADMIN', async () => {
      const token = createToken({
        sub: 'user-owner-1',
        email: 'owner@sinalizego.com',
        role: Role.COMPANY_OWNER,
      });

      await request(app.getHttpServer())
        .get('/admin/invoices')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('deve retornar 200 OK quando acessado por um usuário ADMIN', async () => {
      const token = createToken({
        sub: 'user-admin-1',
        email: 'admin@sinalizego.com',
        role: Role.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .get('/admin/invoices?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('inv-admin-1');
      expect(mockInvoiceService.getAdminInvoices).toHaveBeenCalled();
    });

    it('deve retornar 200 OK para appointments da nota quando acessado por ADMIN', async () => {
      const token = createToken({
        sub: 'user-admin-1',
        email: 'admin@sinalizego.com',
        role: Role.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .get('/admin/invoices/inv-admin-1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockInvoiceService.getInvoiceAppointments).toHaveBeenCalledWith(
        'inv-admin-1',
        undefined,
        true,
      );
    });
  });

  describe('POST /webhooks/asaas (NFS-e Events)', () => {
    it('deve retornar 401 Unauthorized se token de webhook estiver ausente ou incorreto', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .send({
          event: 'INVOICE_AUTHORIZED',
          invoice: { id: 'inv_ext_1' },
        })
        .expect(401);
    });

    it('deve retornar 200 OK e processar evento INVOICE_AUTHORIZED com sucesso', async () => {
      const webhookToken =
        process.env.ASAAS_WEBHOOK_TOKEN || 'test_asaas_webhook';

      const res = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', webhookToken)
        .send({
          event: 'INVOICE_AUTHORIZED',
          invoice: {
            id: 'inv_ext_123',
            status: 'AUTHORIZED',
            pdfUrl: 'https://asaas.com/pdf/inv_ext_123',
            xmlUrl: 'https://asaas.com/xml/inv_ext_123',
            number: '12345',
            verificationCode: 'XYZ987',
          },
        })
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(res.body.status).toBe('AUTHORIZED');
      expect(mockWebhooksService.handleInvoiceEvent).toHaveBeenCalledWith(
        'INVOICE_AUTHORIZED',
        expect.objectContaining({ id: 'inv_ext_123' }),
        undefined,
        expect.anything(),
      );
    });

    it('deve retornar 200 OK e processar evento INVOICE_ERROR com sucesso', async () => {
      const webhookToken =
        process.env.ASAAS_WEBHOOK_TOKEN || 'test_asaas_webhook';

      const res = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', webhookToken)
        .send({
          event: 'INVOICE_ERROR',
          invoice: {
            id: 'inv_ext_error',
            status: 'ERROR',
          },
        })
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(res.body.status).toBe('ERROR');
      expect(mockWebhooksService.handleInvoiceEvent).toHaveBeenCalledWith(
        'INVOICE_ERROR',
        expect.objectContaining({ id: 'inv_ext_error' }),
        undefined,
        expect.anything(),
      );
    });
  });
});
