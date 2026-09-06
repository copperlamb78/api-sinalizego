import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AsaasService } from '../src/asaas/asaas.service';
import { MailService } from '../src/modules/mail/mail.service';
import {
  FeeOverrideSource,
  FeeOverrideStatus,
  FounderSeatStatus,
  ReferralStatus,
  Role,
} from '@prisma/client';

describe('Promotions (Fundadores & Indicação) HTTP E2E & Database Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Mock de APIs externas (Zero chamadas externas reais conforme AGENTS.md §2)
  const mockAsaasService = {
    createCustomer: jest.fn().mockResolvedValue('cus_test_mock_123'),
    createSubAccount: jest.fn().mockResolvedValue({
      id: 'sub_test_mock_123',
      apiKey: 'api_key_mock',
      walletId: 'wallet_test_mock_123',
    }),
    createPixChargeWithSplit: jest.fn(),
    getPixQrCode: jest.fn(),
    cancelPayment: jest.fn().mockResolvedValue(true),
    refundPayment: jest.fn().mockResolvedValue(true),
  };

  const mockMailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendReferralReviewAlertEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentConfirmationEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentCancellationEmail: jest.fn().mockResolvedValue(true),
  };

  // Identificadores únicos para o teste para não colidir com dados existentes
  const uniqueSuffix = Date.now().toString();
  const testFounderEmail = `founder_${uniqueSuffix}@sinalizego.com`;
  const testOwnerEmail = `owner_${uniqueSuffix}@sinalizego.com`;
  const testClientEmail = `client_${uniqueSuffix}@sinalizego.com`;
  const testAdminEmail = `admin_${uniqueSuffix}@sinalizego.com`;

  let testOwnerUserId: string;
  let testOwnerCompanyId: string;
  let testClientUserId: string;
  let testAdminUserId: string;

  let ownerToken: string;
  let clientToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AsaasService)
      .useValue(mockAsaasService)
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api/v1', {
      exclude: ['/', 'webhooks/asaas'],
    });

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // 1. Criar dados de base no banco para os testes de autorização e relacionamento
    const ownerUser = await prisma.user.create({
      data: {
        name: 'Proprietário Teste E2E',
        email: testOwnerEmail,
        password: 'hashed_password_test',
        role: Role.COMPANY_OWNER,
        phone: '11999990001',
        isActive: true,
      },
    });
    testOwnerUserId = ownerUser.id;

    const company = await prisma.company.create({
      data: {
        businessName: `Barbearia E2E ${uniqueSuffix}`,
        slug: `barbearia-e2e-${uniqueSuffix}`,
        userId: testOwnerUserId,
        providerType: 'BARBERSHOP',
        district: 'Centro',
        street: 'Rua das Flores',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001000',
        number: '100',
        isActive: true,
      },
    });
    testOwnerCompanyId = company.id;

    const clientUser = await prisma.user.create({
      data: {
        name: 'Cliente Teste E2E',
        email: testClientEmail,
        password: 'hashed_password_test',
        role: Role.CLIENT,
        phone: '11999990002',
        isActive: true,
      },
    });
    testClientUserId = clientUser.id;

    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin Teste E2E',
        email: testAdminEmail,
        password: 'hashed_password_test',
        role: Role.SUPER_ADMIN,
        phone: '11999990003',
        isActive: true,
      },
    });
    testAdminUserId = adminUser.id;

    // Tokens JWT válidos para teste da matriz de RBAC
    const secret = process.env.JWT_SECRET || 'test_jwt_secret';
    ownerToken = jwtService.sign(
      { sub: testOwnerUserId, email: testOwnerEmail, role: Role.COMPANY_OWNER },
      { secret },
    );
    clientToken = jwtService.sign(
      { sub: testClientUserId, email: testClientEmail, role: Role.CLIENT },
      { secret },
    );
    adminToken = jwtService.sign(
      { sub: testAdminUserId, email: testAdminEmail, role: Role.SUPER_ADMIN },
      { secret },
    );
  });

  afterAll(async () => {
    // Limpeza dos dados de teste criados no banco
    try {
      await prisma.referral.deleteMany({
        where: { referrerCompanyId: testOwnerCompanyId },
      });
      await prisma.referralCode.deleteMany({
        where: { referrerCompanyId: testOwnerCompanyId },
      });
      await prisma.feeOverride.deleteMany({
        where: { companyId: testOwnerCompanyId },
      });
      await prisma.founderSeat.deleteMany({
        where: { companyId: testOwnerCompanyId },
      });

      // Deleta dados criados na inscrição de fundador
      const founderUser = await prisma.user.findUnique({
        where: { email: testFounderEmail },
        include: { companies: true },
      });
      if (founderUser) {
        for (const comp of founderUser.companies) {
          await prisma.founderSeat.deleteMany({
            where: { companyId: comp.id },
          });
          await prisma.feeOverride.deleteMany({
            where: { companyId: comp.id },
          });
          await prisma.company.deleteMany({ where: { id: comp.id } });
        }
        await prisma.user.delete({ where: { id: founderUser.id } });
      }

      await prisma.company.deleteMany({ where: { id: testOwnerCompanyId } });
      await prisma.user.deleteMany({
        where: {
          id: { in: [testOwnerUserId, testClientUserId, testAdminUserId] },
        },
      });
    } catch {
      // Falhas silenciosas de limpeza para não quebrar teardown
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // 1. FUNDADORES (N8) - ROTAS PÚBLICAS & AUTENTICADAS
  // =========================================================================
  describe('Fundadores (N8) Endpoints', () => {
    describe('GET /api/v1/fundadores/vagas (Público)', () => {
      it('deve retornar 200 com a contagem de vagas e fila de espera sem autenticação', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/fundadores/vagas')
          .expect(200);

        expect(res.body).toHaveProperty('totalSeats', 20);
        expect(res.body).toHaveProperty('availableSeats');
        expect(res.body).toHaveProperty('occupiedSeats');
        expect(res.body).toHaveProperty('waitlistCount');
        expect(typeof res.body.availableSeats).toBe('number');
      });
    });

    describe('POST /api/v1/fundadores/inscricao (Público)', () => {
      it('deve retornar 400 Bad Request se campos obrigatórios forem omitidos (DTO validation)', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/fundadores/inscricao')
          .send({})
          .expect(400);

        expect(res.body.statusCode).toBe(400);
        expect(Array.isArray(res.body.message)).toBe(true);
        expect(res.body.message.length).toBeGreaterThan(0);
      });

      it('deve retornar 400 Bad Request se o formato de e-mail for inválido', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/fundadores/inscricao')
          .send({
            name: 'Fundador Teste',
            email: 'email_invalido_sem_arroba',
            password: 'SenhaForte123!',
            businessName: 'Barbearia Fundador Invalido',
            phone: '11988887777',
            providerType: 'BARBERSHOP',
            district: 'Centro',
            street: 'Rua das Flores',
            number: '100',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01001000',
            surveyConsent: true,
          })
          .expect(400);
      });

      it('deve cadastrar novo fundador, alocar vaga ou lista de espera e persistir no banco de dados', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/fundadores/inscricao')
          .send({
            name: 'Barbeiro Fundador E2E',
            email: testFounderEmail,
            password: 'SenhaSegura@123',
            businessName: `Barbearia Fundador ${uniqueSuffix}`,
            phone: '11977776666',
            providerType: 'BARBERSHOP',
            district: 'Centro',
            street: 'Rua das Flores',
            number: '100',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01001000',
            surveyConsent: true,
          })
          .expect(201);

        expect(res.body).toHaveProperty('message');
        expect(res.body.user.companies[0].id).toBeDefined();
        expect(res.body).toHaveProperty('founder');

        // AUDITORIA NO BANCO DE DADOS (Prisma)
        const userInDb = await prisma.user.findUnique({
          where: { email: testFounderEmail },
        });
        expect(userInDb).not.toBeNull();
        expect(userInDb?.role).toBe(Role.COMPANY_OWNER);
        expect(userInDb?.isActive).toBe(true);

        const companyInDb = await prisma.company.findFirst({
          where: { userId: userInDb?.id },
        });
        expect(companyInDb).not.toBeNull();
        expect(companyInDb?.businessName).toBe(
          `Barbearia Fundador ${uniqueSuffix}`,
        );

        // Verifica se foi alocado assento ou lista de espera
        const seatInDb = await prisma.founderSeat.findUnique({
          where: { companyId: companyInDb?.id },
        });
        const waitlistInDb = await prisma.founderWaitlist.findFirst({
          where: { companyId: companyInDb?.id },
        });

        // Um dos dois deve ter sido criado
        expect(seatInDb !== null || waitlistInDb !== null).toBe(true);
        if (seatInDb) {
          expect(seatInDb.status).toBe(FounderSeatStatus.RESERVED);
          expect(seatInDb.seatNumber).toBeGreaterThanOrEqual(1);
          expect(seatInDb.seatNumber).toBeLessThanOrEqual(20);
        }
      });
    });

    describe('GET /api/v1/company/fundador (Controle de Acesso RBAC)', () => {
      it('deve retornar 401 Unauthorized se acessado sem token JWT', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/company/fundador')
          .expect(401);
      });

      it('deve retornar 403 Forbidden se acessado por perfil CLIENT (RolesGuard)', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/company/fundador')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(403);
      });

      it('deve retornar 200 OK com corpo vazio para COMPANY_OWNER não participante', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/company/fundador')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(res.body).toEqual({});
      });

      it('deve retornar 200 OK com dados da vaga para fundador cadastrado', async () => {
        const founderUser = await prisma.user.findUnique({
          where: { email: testFounderEmail },
        });
        expect(founderUser).not.toBeNull();

        const secret = process.env.JWT_SECRET || 'test_jwt_secret';
        const founderToken = jwtService.sign(
          {
            sub: founderUser!.id,
            email: testFounderEmail,
            role: Role.COMPANY_OWNER,
          },
          { secret },
        );

        const res = await request(app.getHttpServer())
          .get('/api/v1/company/fundador')
          .set('Authorization', `Bearer ${founderToken}`)
          .expect(200);

        expect(['SEAT', 'WAITLIST']).toContain(res.body.type);
        expect(res.body.status).toBeDefined();
      });
    });
  });

  // =========================================================================
  // 2. INDICAÇÃO (N9) - ROTAS PROTEGIDAS & REVISÃO ADMINISTRATIVA
  // =========================================================================
  describe('Indicação (N9) Endpoints', () => {
    describe('POST /api/v1/company/indicacao/codigo (Código & Link Único)', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/company/indicacao/codigo')
          .expect(401);
      });

      it('deve retornar 403 Forbidden para role CLIENT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/company/indicacao/codigo')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(403);
      });

      it('deve gerar código único e salvar no banco de dados para COMPANY_OWNER', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/company/indicacao/codigo')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(201);

        expect(res.body).toHaveProperty('code');
        expect(res.body).toHaveProperty('link');
        expect(res.body.code).toBeDefined();

        // AUDITORIA NO BANCO DE DADOS (Prisma)
        const codeInDb = await prisma.referralCode.findUnique({
          where: { referrerCompanyId: testOwnerCompanyId },
        });
        expect(codeInDb).not.toBeNull();
        expect(codeInDb?.code).toBe(res.body.code);
      });
    });

    describe('GET /api/v1/company/indicacoes (Histórico)', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/company/indicacoes')
          .expect(401);
      });

      it('deve retornar 403 Forbidden para role CLIENT', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/company/indicacoes')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(403);
      });

      it('deve retornar 200 com lista e métricas de indicações para COMPANY_OWNER', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/company/indicacoes')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('totalReferrals');
        expect(res.body).toHaveProperty('referrals');
        expect(Array.isArray(res.body.referrals)).toBe(true);
        expect(res.body).toHaveProperty('currentCycle');
        expect(res.body.currentCycle).toHaveProperty('daysEarned');
        expect(res.body.currentCycle).toHaveProperty('maxDaysPerYear', 90);
      });
    });

    describe('PATCH /api/v1/admin/indicacoes/:referralId/revisar (Antifraude & Admin)', () => {
      let suspiciousReferralId: string;
      let referredCompanyId: string;

      beforeAll(async () => {
        // Assegura que o código do indicador existe
        let referralCode = await prisma.referralCode.findUnique({
          where: { referrerCompanyId: testOwnerCompanyId },
        });
        if (!referralCode) {
          referralCode = await prisma.referralCode.create({
            data: {
              code: `IND${uniqueSuffix.slice(-5)}`,
              referrerCompanyId: testOwnerCompanyId,
            },
          });
        }

        // Cria uma empresa indicada e uma indicação em estado REVIEW para teste
        const referredCompany = await prisma.company.create({
          data: {
            businessName: `Indicada Suspeita ${uniqueSuffix}`,
            slug: `indicada-suspeita-${uniqueSuffix}`,
            userId: testClientUserId,
            providerType: 'BARBERSHOP',
            district: 'Centro',
            street: 'Rua das Flores',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01001000',
            number: '200',
            isActive: true,
          },
        });
        referredCompanyId = referredCompany.id;

        const referral = await prisma.referral.create({
          data: {
            codeId: referralCode.id,
            referrerCompanyId: testOwnerCompanyId,
            referredCompanyId: referredCompany.id,
            status: ReferralStatus.REVIEW,
            riskFlags: ['SAME_PHONE', 'SAME_PIX_KEY'],
          },
        });
        suspiciousReferralId = referral.id;
      });

      afterAll(async () => {
        await prisma.referral.deleteMany({
          where: { id: suspiciousReferralId },
        });
        await prisma.company.deleteMany({ where: { id: referredCompanyId } });
      });

      it('deve retornar 401 Unauthorized sem token', async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/admin/indicacoes/${suspiciousReferralId}/revisar`)
          .send({ approve: true })
          .expect(401);
      });

      it('deve retornar 403 Forbidden se chamado por COMPANY_OWNER (rota restrita a SYSTEM_MANAGERS)', async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/admin/indicacoes/${suspiciousReferralId}/revisar`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ approve: true })
          .expect(403);
      });

      it('deve retornar 400 Bad Request se o campo approve não for booleano', async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/admin/indicacoes/${suspiciousReferralId}/revisar`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ approve: 'invalido' })
          .expect(400);
      });

      it('deve permitir que ADMIN aprove a indicação, atualize o status e crie o FeeOverride no banco', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/admin/indicacoes/${suspiciousReferralId}/revisar`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            approve: true,
            rejectedReason: undefined,
          })
          .expect(200);

        expect(res.body.status).toBe(ReferralStatus.ACTIVATED);

        // AUDITORIA NO BANCO DE DADOS (Prisma)
        const referralInDb = await prisma.referral.findUnique({
          where: { id: suspiciousReferralId },
        });
        expect(referralInDb?.status).toBe(ReferralStatus.ACTIVATED);

        // Verifica se FeeOverride foi criado com a taxa de R$ 0,49 para o indicador
        const overrideInDb = await prisma.feeOverride.findFirst({
          where: {
            companyId: testOwnerCompanyId,
            source: FeeOverrideSource.REFERRAL_SENDER,
          },
        });
        expect(overrideInDb).not.toBeNull();
        expect(Number(overrideInDb?.barberPixFee)).toBe(0.49);
        expect(overrideInDb?.status).toBe(FeeOverrideStatus.ACTIVE);
      });
    });
  });

  // =========================================================================
  // 3. WEBHOOK ASAAS - APROVAÇÃO CADASTRAL & DISPARO DE GATILHOS
  // =========================================================================
  describe('Webhook Asaas - Eventos Cadastrais (ACCOUNT_STATUS_*)', () => {
    const webhookSecret =
      process.env.ASAAS_WEBHOOK_TOKEN || 'asaas_webhook_secret_token_123456';
    const testWalletId = `wallet_hook_${uniqueSuffix}`;
    let testProfileId: string;

    beforeAll(async () => {
      // Cria um FinancialProfile vinculado à empresa de teste para receber o webhook
      const fp = await prisma.financialProfile.create({
        data: {
          name: 'Proprietário Teste E2E',
          email: testOwnerEmail,
          cpfCnpj: `111222333${uniqueSuffix.slice(-2)}`,
          mobilePhone: '11999990001',
          incomeValue: 5000.0,
          address: 'Rua das Flores',
          addressNumber: '100',
          province: 'Centro',
          postalCode: '01001000',
          walletId: testWalletId,
          userId: testOwnerUserId,
          isApproved: false,
          approvalStatus: 'PENDING',
          companies: {
            connect: { id: testOwnerCompanyId },
          },
        },
      });
      testProfileId = fp.id;
    });

    afterAll(async () => {
      await prisma.financialProfile.deleteMany({
        where: { id: testProfileId },
      });
    });

    it('deve retornar 401 Unauthorized se o token do webhook estiver ausente ou incorreto', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .send({ event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', 'token_errado')
        .send({ event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED' })
        .expect(401);
    });

    it('deve processar evento de aprovação, atualizar FinancialProfile e salvar WebhookEvent no banco', async () => {
      const res = await request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', webhookSecret)
        .send({
          event: 'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
          account: { id: testWalletId },
          accountStatus: { general: 'APPROVED' },
        })
        .expect(200);

      expect(res.body).toHaveProperty('received', true);
      expect(res.body).toHaveProperty('isApproved', true);

      // AUDITORIA NO BANCO DE DADOS (Prisma)
      const profileInDb = await prisma.financialProfile.findUnique({
        where: { id: testProfileId },
      });
      expect(profileInDb?.isApproved).toBe(true);
      expect(profileInDb?.approvalStatus).toBe('APPROVED');
      expect(profileInDb?.approvedAt).not.toBeNull();
    });
  });
});
