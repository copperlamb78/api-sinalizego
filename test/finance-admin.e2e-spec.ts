import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AsaasService } from '../src/asaas/asaas.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { MailService } from '../src/modules/mail/mail.service';
import {
  Role,
  ApptStatus,
  TransactionStatus,
  BillingType,
} from '@prisma/client';
import bcrypt from 'bcrypt';

describe('Finance, Withdrawals, Admin & Gateway HTTP E2E Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockAsaasService = {
    createCustomer: jest.fn().mockImplementation((dto) =>
      Promise.resolve({
        id: `cus_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: dto.name,
        email: dto.email,
      }),
    ),
    createSubAccount: jest.fn().mockImplementation((data) =>
      Promise.resolve({
        id: `sub_${Date.now()}`,
        name: data.name,
        email: data.email,
        walletId: `wallet_sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        apiKey: '$aact_mock_subaccount_api_key_123456789',
      }),
    ),
    listAllSubAccounts: jest.fn().mockResolvedValue([
      {
        id: 'sub_123',
        name: 'Barbearia Modelo',
        email: 'modelo@barbearia.com',
        walletId: 'wallet_123',
      },
    ]),
    listSubAccountById: jest.fn().mockImplementation((id) =>
      Promise.resolve({
        id,
        name: 'Barbearia Modelo',
        email: 'modelo@barbearia.com',
        walletId: 'wallet_123',
      }),
    ),
    getAccountBalance: jest.fn().mockResolvedValue({
      balance: 1500.0,
    }),
    getTransferFee: jest.fn().mockResolvedValue(5.0),
    transferSubaccountBalance: jest.fn().mockResolvedValue({
      id: 'transf_mock_123',
      status: 'DONE',
      value: 45.0,
    }),
    getPaymentById: jest.fn().mockImplementation((paymentId) =>
      Promise.resolve({
        id: paymentId,
        status: 'RECEIVED',
        value: 27.5,
      }),
    ),
    createPixChargeWithSplit: jest.fn().mockResolvedValue({
      paymentId: 'pay_mock_pix_123',
      totalValue: 27.5,
      qrCodePayload: 'mockqrpayload',
      qrCodeImage: 'data:image/png;base64,mockqr',
      expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      barberNetValue: 24.01,
      platformFee: 2.5,
      asaasFee: 0.99,
      barberFeeApplied: 0.99,
    }),
    getPixQrCode: jest.fn().mockResolvedValue({
      qrCodePayload: 'mockqrpayload',
      qrCodeImage: 'data:image/png;base64,mockqr',
      expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
  };

  const mockCloudinaryService = {
    uploadImage: jest.fn().mockResolvedValue({
      secure_url:
        'https://res.cloudinary.com/sinalizego/image/upload/mock_img.jpg',
      public_id: 'mock_public_id',
    }),
  };

  const mockMailService = {
    sendMail: jest.fn().mockResolvedValue(true),
    sendEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentConfirmationEmail: jest.fn().mockResolvedValue(true),
  };

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const adminEmail = `admin_fin_${uniqueSuffix}@sinalizego.com`;
  const owner1Email = `owner1_fin_${uniqueSuffix}@sinalizego.com`;
  const owner2Email = `owner2_fin_${uniqueSuffix}@sinalizego.com`;
  const clientEmail = `client_fin_${uniqueSuffix}@sinalizego.com`;

  let adminUserId: string;
  let owner1UserId: string;
  let owner1CompanyId: string;
  let owner1FinancialProfileId: string;

  let owner2UserId: string;
  let owner2CompanyId: string;
  let owner2FinancialProfileId: string;

  let clientUserId: string;

  let adminToken: string;
  let owner1Token: string;
  let owner2Token: string;
  let clientToken: string;

  let createdProfileId: string;
  let seededAppointmentId: string;
  let seededPaymentId: string;

  beforeAll(async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'test_webhook_token_123';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AsaasService)
      .useValue(mockAsaasService)
      .overrideProvider(CloudinaryService)
      .useValue(mockCloudinaryService)
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    const hashedPassword = await bcrypt.hash('Password@123', 10);

    // 1. Criar Super Admin
    const adminUser = await prisma.user.create({
      data: {
        name: 'Super Admin E2E',
        email: adminEmail,
        password: hashedPassword,
        phone: '11977770000',
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
    adminUserId = adminUser.id;

    // 2. Criar Owner 1 com Empresa 1 e Perfil Financeiro vinculado
    const user1 = await prisma.user.create({
      data: {
        name: 'Proprietário Fin 1',
        email: owner1Email,
        password: hashedPassword,
        phone: '11977771111',
        role: Role.COMPANY_OWNER,
        isActive: true,
      },
    });
    owner1UserId = user1.id;

    const company1 = await prisma.company.create({
      data: {
        businessName: `Barbearia Fin 1 ${uniqueSuffix}`,
        slug: `barbearia-fin-1-${uniqueSuffix}`,
        userId: owner1UserId,
        providerType: 'BARBERSHOP',
        district: 'Centro',
        street: 'Rua Principal',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        number: '10',
        isActive: true,
      },
    });
    owner1CompanyId = company1.id;

    const finProfile1 = await prisma.financialProfile.create({
      data: {
        userId: owner1UserId,
        name: 'Proprietário Fin 1',
        email: owner1Email,
        cpfCnpj: `444${Date.now().toString().slice(-8)}`,
        mobilePhone: '11977771111',
        incomeValue: 8000.0,
        address: 'Rua Principal',
        addressNumber: '10',
        province: 'Centro',
        postalCode: '01001000',
        walletId: `wallet_fin1_${uniqueSuffix}`,
        pixAddressKey: '11977771111',
        pixAddressKeyType: 'PHONE',
        isActive: true,
      },
    });
    owner1FinancialProfileId = finProfile1.id;

    await prisma.company.update({
      where: { id: owner1CompanyId },
      data: { financialProfileId: owner1FinancialProfileId },
    });

    // 3. Criar Owner 2 e Empresa 2 (Tenant concorrente para Anti-IDOR)
    const user2 = await prisma.user.create({
      data: {
        name: 'Proprietário Fin 2',
        email: owner2Email,
        password: hashedPassword,
        phone: '11977772222',
        role: Role.COMPANY_OWNER,
        isActive: true,
      },
    });
    owner2UserId = user2.id;

    const company2 = await prisma.company.create({
      data: {
        businessName: `Barbearia Fin 2 ${uniqueSuffix}`,
        slug: `barbearia-fin-2-${uniqueSuffix}`,
        userId: owner2UserId,
        providerType: 'BARBERSHOP',
        district: 'Bairro Novo',
        street: 'Avenida Brasil',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13010000',
        number: '20',
        isActive: true,
      },
    });
    owner2CompanyId = company2.id;

    const finProfile2 = await prisma.financialProfile.create({
      data: {
        userId: owner2UserId,
        name: 'Proprietário Fin 2',
        email: owner2Email,
        cpfCnpj: `555${Date.now().toString().slice(-8)}`,
        mobilePhone: '11977772222',
        incomeValue: 9000.0,
        address: 'Avenida Brasil',
        addressNumber: '20',
        province: 'Bairro Novo',
        postalCode: '13010000',
        walletId: `wallet_fin2_${uniqueSuffix}`,
        pixAddressKey: '11977772222',
        pixAddressKeyType: 'PHONE',
        isActive: true,
      },
    });
    owner2FinancialProfileId = finProfile2.id;

    await prisma.company.update({
      where: { id: owner2CompanyId },
      data: { financialProfileId: owner2FinancialProfileId },
    });

    // 4. Criar Usuário Cliente
    const clientUser = await prisma.user.create({
      data: {
        name: 'Cliente Fin E2E',
        email: clientEmail,
        password: hashedPassword,
        phone: '11977773333',
        cpfCnpj: `666${Date.now().toString().slice(-8)}`,
        role: Role.CLIENT,
        isActive: true,
      },
    });
    clientUserId = clientUser.id;

    // Tokens JWT
    const secret = process.env.JWT_SECRET || 'test_jwt_secret';
    adminToken = jwtService.sign(
      { sub: adminUserId, email: adminEmail, role: Role.SUPER_ADMIN },
      { secret },
    );
    owner1Token = jwtService.sign(
      { sub: owner1UserId, email: owner1Email, role: Role.COMPANY_OWNER },
      { secret },
    );
    owner2Token = jwtService.sign(
      { sub: owner2UserId, email: owner2Email, role: Role.COMPANY_OWNER },
      { secret },
    );
    clientToken = jwtService.sign(
      { sub: clientUserId, email: clientEmail, role: Role.CLIENT },
      { secret },
    );
  });

  afterAll(async () => {
    try {
      if (createdProfileId) {
        await prisma.financialProfile.deleteMany({
          where: { id: createdProfileId },
        });
      }
      if (seededAppointmentId) {
        await prisma.transaction.deleteMany({
          where: { appointmentId: seededAppointmentId },
        });
        await prisma.appointment.deleteMany({
          where: { id: seededAppointmentId },
        });
      }
      await prisma.transaction.deleteMany({
        where: {
          barberWalletId: {
            in: [`wallet_fin1_${uniqueSuffix}`, `wallet_fin2_${uniqueSuffix}`],
          },
        },
      });
      await prisma.company.deleteMany({
        where: { id: { in: [owner1CompanyId, owner2CompanyId] } },
      });
      await prisma.financialProfile.deleteMany({
        where: { userId: { in: [owner1UserId, owner2UserId, adminUserId] } },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [owner1UserId, owner2UserId, clientUserId, adminUserId] },
        },
      });
    } catch {
      // Cleanup silencioso
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // 1. PERFIL FINANCEIRO (SUBCONTA ASAAS, CONSULTA E CICLO DE VIDA)
  // =========================================================================
  describe('Financial Profile Endpoints', () => {
    describe('POST /api/v1/financial-profile/create', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/financial-profile/create')
          .send({})
          .expect(401);
      });

      it('deve retornar 403 Forbidden para perfil CLIENT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/financial-profile/create')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({})
          .expect(403);
      });

      it('deve criar novo perfil financeiro e chamar a criação de subconta no Asaas', async () => {
        const payload = {
          name: 'João Barbeiro Individual',
          email: `joao_${uniqueSuffix}@barbearia.com`,
          cpfCnpj: `777${Date.now().toString().slice(-8)}`,
          birthDate: '1990-05-15',
          mobilePhone: '11977774444',
          incomeValue: 7500.0,
          pixAddressKey: '11977774444',
          pixAddressKeyType: 'PHONE',
        };

        const res = await request(app.getHttpServer())
          .post('/api/v1/financial-profile/create')
          .set('Authorization', `Bearer ${owner2Token}`)
          .send(payload)
          .expect(201);

        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('João Barbeiro Individual');
        expect(res.body).toHaveProperty('walletId');

        createdProfileId = res.body.id;

        // AUDITORIA NO BANCO DE DADOS
        const profileInDb = await prisma.financialProfile.findUnique({
          where: { id: createdProfileId },
        });

        expect(profileInDb).not.toBeNull();
        expect(profileInDb?.userId).toBe(owner2UserId);
        expect(profileInDb?.isActive).toBe(true);
        expect(mockAsaasService.createSubAccount).toHaveBeenCalled();
      });
    });

    describe('GET /api/v1/financial-profile/list & /user/:id (Anti-IDOR)', () => {
      it('deve listar os perfis financeiros do usuário logado', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/financial-profile/list')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(
          res.body.some((p: any) => p.id === owner1FinancialProfileId),
        ).toBe(true);
      });

      it('deve bloquear acesso se o Tenant 2 tentar consultar o perfil financeiro do Tenant 1 (Anti-IDOR)', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/financial-profile/user/${owner1FinancialProfileId}`)
          .set('Authorization', `Bearer ${owner2Token}`);

        expect([403, 404]).toContain(res.status);
      });

      it('deve retornar 200 OK quando consultado pelo próprio dono', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/financial-profile/user/${owner1FinancialProfileId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(res.body.id).toBe(owner1FinancialProfileId);
      });
    });

    describe('Soft Delete & Reativação de Perfil Financeiro', () => {
      it('deve desativar perfil financeiro com soft delete', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/api/v1/financial-profile/deactivate/${createdProfileId}`)
          .set('Authorization', `Bearer ${owner2Token}`)
          .expect(200);

        expect(res.body.isActive).toBe(false);

        const profileInDb = await prisma.financialProfile.findUnique({
          where: { id: createdProfileId },
        });
        expect(profileInDb?.isActive).toBe(false);
      });

      it('deve reativar perfil financeiro desativado', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/financial-profile/activate/${createdProfileId}`)
          .set('Authorization', `Bearer ${owner2Token}`)
          .expect(200);

        expect(res.body.isActive).toBe(true);

        const profileInDb = await prisma.financialProfile.findUnique({
          where: { id: createdProfileId },
        });
        expect(profileInDb?.isActive).toBe(true);
      });
    });
  });

  // =========================================================================
  // 2. SALDO, ESCROW E SAQUES (WITHDRAWALS & REGRAS FINANCEIRAS)
  // =========================================================================
  describe('Company Balance & Withdrawals', () => {
    it('deve consultar saldo da empresa (Escrow e Saldo Disponível)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/company/balance')
        .set('Authorization', `Bearer ${owner1Token}`)
        .expect(200);

      expect(res.body).toHaveProperty('availableBalance');
      expect(res.body).toHaveProperty('escrowLockedBalance');
      expect(res.body).toHaveProperty('totalWithdrawn');
    });

    it('deve retornar 400 Bad Request ao solicitar saque com saldo insuficiente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/company/withdraw')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ amount: 1000.0 })
        .expect(400);
    });

    it('deve realizar saque avulso com sucesso quando há saldo disponível, deduzindo taxa de R$ 5,00', async () => {
      // 1. Injeta diretamente no banco um agendamento COMPLETED para gerar saldo disponível para a Empresa 1:
      // Saldo gerado = R$ 100.00
      const group = await prisma.serviceGroup.create({
        data: {
          name: 'Corte Rápido',
          capacity: 1,
          companyId: owner1CompanyId,
        },
      });

      const service = await prisma.service.create({
        data: {
          name: 'Corte Especial',
          durationMinutes: 45,
          totalPrice: 200.0,
          downPaymentPercent: 50,
          serviceGroupId: group.id,
          companyId: owner1CompanyId,
        },
      });

      const appt = await prisma.appointment.create({
        data: {
          companyId: owner1CompanyId,
          serviceId: service.id,
          clientId: clientUserId,
          appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
          appointmentEndDate: new Date('2026-08-01T10:45:00.000Z'),
          status: ApptStatus.COMPLETED,
          servicePrice: 200.0,
          downPaymentAmount: 100.0,
          platformFeeAmount: 10.0,
          isActive: true,
        },
      });
      seededAppointmentId = appt.id;

      await prisma.transaction.create({
        data: {
          asaasPaymentId: `pay_seed_${uniqueSuffix}`,
          barberWalletId: `wallet_fin1_${uniqueSuffix}`,
          type: 'DEPOSIT',
          status: TransactionStatus.CONFIRMED,
          billingType: BillingType.PIX,
          totalValue: 110.0,
          netValue: 99.01,
          platformFee: 10.0,
          asaasFee: 0.99,
          customerId: clientUserId,
          appointmentId: appt.id,
        },
      });

      // 2. Solicita saque de R$ 50.00
      const res = await request(app.getHttpServer())
        .post('/api/v1/company/withdraw')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ amount: 50.0 })
        .expect(201);

      expect(res.body).toHaveProperty('withdrawal');
      expect(res.body.withdrawal.requestedAmount).toBe(50.0);
      expect(res.body.withdrawal.transferFee).toBe(5.0); // ASAAS_TRANSFER_FEE = R$ 5,00
      expect(res.body.withdrawal.netAmountTransferred).toBe(45.0); // 50 - 5 = 45
      expect(mockAsaasService.transferSubaccountBalance).toHaveBeenCalled();
    });

    it('deve listar o histórico de saques realizados pela empresa', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/company/withdrawals')
        .set('Authorization', `Bearer ${owner1Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].requestedAmount).toBe(50.0);
    });
  });

  // =========================================================================
  // 3. ADMINISTRAÇÃO GLOBAL (SUPER_ADMIN & METRICS)
  // =========================================================================
  describe('Admin Global & Platform Intelligence', () => {
    describe('GET /api/v1/admin/dashboard/metrics', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/admin/dashboard/metrics')
          .expect(401);
      });

      it('deve retornar 403 Forbidden para perfil COMPANY_OWNER', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/admin/dashboard/metrics')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(403);
      });

      it('deve retornar 200 OK com métricas do SaaS para SUPER_ADMIN', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/admin/dashboard/metrics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('financial');
        expect(res.body.financial).toHaveProperty('platformGrossRevenue');
        expect(res.body.financial).toHaveProperty('gmv');
        expect(res.body).toHaveProperty('growth');
        expect(res.body.growth).toHaveProperty('companies');
        expect(res.body.growth).toHaveProperty('appointments');
      });
    });

    describe('GET /api/v1/admin/companies & Toggle Status', () => {
      it('deve listar todas as empresas para o SUPER_ADMIN com paginação', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/admin/companies')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.some((c: any) => c.id === owner1CompanyId)).toBe(
          true,
        );
      });

      it('deve alternar status ativo/suspenso da empresa pelo SUPER_ADMIN', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/admin/companies/${owner2CompanyId}/toggle-status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('company');
        expect(res.body.company.isActive).toBe(false);

        // AUDITORIA NO BANCO
        const companyInDb = await prisma.company.findUnique({
          where: { id: owner2CompanyId },
        });
        expect(companyInDb?.isActive).toBe(false);
      });
    });
  });

  // =========================================================================
  // 4. GATEWAY ASAAS & WEBHOOK (PAYMENT STATE MACHINE)
  // =========================================================================
  describe('Asaas Accounts & Webhook Integration', () => {
    describe('GET /api/v1/asaas/accounts', () => {
      it('deve retornar 403 Forbidden para não administradores', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/asaas/accounts')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(403);
      });

      it('deve retornar lista de subcontas Asaas para SUPER_ADMIN', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/asaas/accounts')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(mockAsaasService.listAllSubAccounts).toHaveBeenCalled();
      });
    });

    describe('POST /api/v1/webhooks/asaas (Confirmação Atômica de Pagamento)', () => {
      it('deve retornar 401 Unauthorized se token de webhook for inválido ou ausente', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/webhooks/asaas')
          .send({ event: 'PAYMENT_RECEIVED' })
          .expect(401);
      });

      it('deve processar evento PAYMENT_RECEIVED e transicionar agendamento para CONFIRMED', async () => {
        // 1. Cria agendamento e transação em PENDING_PAYMENT
        seededPaymentId = `pay_e2e_webhook_${Date.now()}`;
        const service = await prisma.service.findFirst({
          where: { companyId: owner1CompanyId },
        });

        const pendingAppt = await prisma.appointment.create({
          data: {
            companyId: owner1CompanyId,
            serviceId: service!.id,
            clientId: clientUserId,
            appointmentDate: new Date('2026-11-10T14:00:00.000Z'),
            appointmentEndDate: new Date('2026-11-10T14:30:00.000Z'),
            status: ApptStatus.PENDING_PAYMENT,
            servicePrice: 50.0,
            downPaymentAmount: 25.0,
            platformFeeAmount: 2.5,
            isActive: true,
          },
        });

        await prisma.transaction.create({
          data: {
            asaasPaymentId: seededPaymentId,
            totalValue: 27.5,
            netValue: 24.01,
            platformFee: 2.5,
            asaasFee: 0.99,
            barberFeeApplied: 0.99,
            status: TransactionStatus.PENDING,
            type: 'DEPOSIT',
            billingType: BillingType.PIX,
            customerId: clientUserId,
            barberWalletId: `wallet_fin1_${uniqueSuffix}`,
            appointmentId: pendingAppt.id,
          },
        });

        // 2. Dispara webhook autenticado simulando confirmação de Pix pelo gateway Asaas
        const webhookPayload = {
          id: `evt_${Date.now()}`,
          event: 'PAYMENT_RECEIVED',
          payment: {
            id: seededPaymentId,
            status: 'RECEIVED',
            value: 27.5,
          },
        };

        const res = await request(app.getHttpServer())
          .post('/api/v1/webhooks/asaas')
          .set('asaas-access-token', 'test_webhook_token_123')
          .send(webhookPayload)
          .expect(200);

        expect(res.body.received).toBe(true);

        // AUDITORIA NO BANCO DE DADOS:
        // A máquina de estados deve transicionar o agendamento para CONFIRMED
        const updatedAppt = await prisma.appointment.findUnique({
          where: { id: pendingAppt.id },
        });
        expect(updatedAppt?.status).toBe(ApptStatus.CONFIRMED);

        const updatedTx = await prisma.transaction.findUnique({
          where: { asaasPaymentId: seededPaymentId },
        });
        expect(updatedTx?.status).toBe(TransactionStatus.CONFIRMED);
      });
    });
  });
});
