import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AsaasService } from '../src/asaas/asaas.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { MailService } from '../src/modules/mail/mail.service';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('Appointments, WorkingHours & Transactions HTTP E2E Integration', () => {
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
    createPixChargeWithSplit: jest
      .fn()
      .mockImplementation(
        (
          customerId,
          walletId,
          deposit,
          appointmentId,
          platformFee,
          effectiveFee,
        ) => {
          const totalValue = Number((deposit + platformFee).toFixed(2));
          const asaasFee = 0.99;
          const barberNetValue = Number(
            (deposit - (effectiveFee ?? 0.99)).toFixed(2),
          );
          return Promise.resolve({
            paymentId: `pay_mock_pix_${Date.now()}`,
            totalValue,
            qrCodePayload: '00020126580014BR.GOV.BCB.PIXmockpayload',
            qrCodeImage: 'data:image/png;base64,mockqr',
            expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            barberNetValue,
            platformFee,
            asaasFee,
            barberFeeApplied: effectiveFee ?? 0.99,
          });
        },
      ),
    getPixQrCode: jest.fn().mockResolvedValue({
      qrCodePayload: '00020126580014BR.GOV.BCB.PIXmockpayload',
      qrCodeImage: 'data:image/png;base64,mockqr',
      expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    refundPayment: jest.fn().mockResolvedValue({
      id: 'ref_mock_123',
      status: 'REFUNDED',
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
    sendAppointmentCancellationEmail: jest.fn().mockResolvedValue(true),
    sendAppointmentConfirmationEmail: jest.fn().mockResolvedValue(true),
  };

  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const owner1Email = `owner1_appt_${uniqueSuffix}@sinalizego.com`;
  const owner2Email = `owner2_appt_${uniqueSuffix}@sinalizego.com`;
  const clientEmail = `client_appt_${uniqueSuffix}@sinalizego.com`;

  let owner1UserId: string;
  let owner1CompanyId: string;
  let owner1ServiceGroupId: string;
  let owner1ServiceId: string;

  let owner2UserId: string;
  let owner2CompanyId: string;

  let clientUserId: string;

  let owner1Token: string;
  let owner2Token: string;
  let clientToken: string;

  let createdAppointmentId: string;
  let createdExceptionId: string;

  beforeAll(async () => {
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

    // 1. Criar Owner 1 e Empresa 1 com Perfil Financeiro
    const user1 = await prisma.user.create({
      data: {
        name: 'Proprietário 1 Appt',
        email: owner1Email,
        password: hashedPassword,
        phone: '11988881111',
        role: Role.COMPANY_OWNER,
        isActive: true,
      },
    });
    owner1UserId = user1.id;

    const company1 = await prisma.company.create({
      data: {
        businessName: `Barbearia Appt 1 ${uniqueSuffix}`,
        slug: `barbearia-appt-1-${uniqueSuffix}`,
        userId: owner1UserId,
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
    owner1CompanyId = company1.id;

    const finProfile1 = await prisma.financialProfile.create({
      data: {
        userId: owner1UserId,
        name: 'Proprietário 1 Appt',
        email: owner1Email,
        cpfCnpj: `112${Date.now().toString().slice(-8)}`,
        mobilePhone: '11988881111',
        incomeValue: 6000.0,
        address: 'Rua das Flores',
        addressNumber: '100',
        province: 'Centro',
        postalCode: '01001000',
        walletId: `wallet_appt1_${uniqueSuffix}`,
        isActive: true,
      },
    });
    await prisma.company.update({
      where: { id: owner1CompanyId },
      data: { financialProfileId: finProfile1.id },
    });

    const serviceGroup1 = await prisma.serviceGroup.create({
      data: {
        name: 'Cabelo',
        capacity: 2,
        companyId: owner1CompanyId,
      },
    });
    owner1ServiceGroupId = serviceGroup1.id;

    const service1 = await prisma.service.create({
      data: {
        name: 'Corte Tradicional',
        description: 'Corte masculino na tesoura e máquina',
        durationMinutes: 30,
        totalPrice: 50.0,
        downPaymentPercent: 50,
        serviceGroupId: owner1ServiceGroupId,
        companyId: owner1CompanyId,
      },
    });
    owner1ServiceId = service1.id;

    // 2. Criar Owner 2 e Empresa 2 (Tenant concorrente para Anti-IDOR)
    const user2 = await prisma.user.create({
      data: {
        name: 'Proprietário 2 Appt',
        email: owner2Email,
        password: hashedPassword,
        phone: '11988882222',
        role: Role.COMPANY_OWNER,
        isActive: true,
      },
    });
    owner2UserId = user2.id;

    const company2 = await prisma.company.create({
      data: {
        businessName: `Barbearia Appt 2 ${uniqueSuffix}`,
        slug: `barbearia-appt-2-${uniqueSuffix}`,
        userId: owner2UserId,
        providerType: 'BARBERSHOP',
        district: 'Vila Nova',
        street: 'Avenida Brasil',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13010000',
        number: '200',
        isActive: true,
      },
    });
    owner2CompanyId = company2.id;

    // 3. Criar Usuário Cliente com asaasCustomerId e cpfCnpj
    const clientUser = await prisma.user.create({
      data: {
        name: 'Cliente Agendamento E2E',
        email: clientEmail,
        password: hashedPassword,
        phone: '11988883333',
        cpfCnpj: `333${Date.now().toString().slice(-8)}`,
        role: Role.CLIENT,
        isActive: true,
        asaasCustomerId: `cus_client_${uniqueSuffix}`,
      },
    });
    clientUserId = clientUser.id;

    const secret = process.env.JWT_SECRET || 'test_jwt_secret';
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
      if (createdAppointmentId) {
        await prisma.transaction.deleteMany({
          where: { appointmentId: createdAppointmentId },
        });
        await prisma.appointment.deleteMany({
          where: { id: createdAppointmentId },
        });
      }
      if (createdExceptionId) {
        await prisma.scheduleException.deleteMany({
          where: { id: createdExceptionId },
        });
      }
      await prisma.workingHour.deleteMany({
        where: { companyId: { in: [owner1CompanyId, owner2CompanyId] } },
      });
      await prisma.service.deleteMany({
        where: { companyId: { in: [owner1CompanyId, owner2CompanyId] } },
      });
      await prisma.serviceGroup.deleteMany({
        where: { companyId: { in: [owner1CompanyId, owner2CompanyId] } },
      });
      await prisma.company.deleteMany({
        where: { id: { in: [owner1CompanyId, owner2CompanyId] } },
      });
      await prisma.financialProfile.deleteMany({
        where: { userId: { in: [owner1UserId, owner2UserId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [owner1UserId, owner2UserId, clientUserId] } },
      });
    } catch {
      // Cleanup silencioso
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // 1. HORÁRIOS DE FUNCIONAMENTO (WORKING HOURS)
  // =========================================================================
  describe('WorkingHours Endpoints', () => {
    const weeklySchedule = {
      hours: [
        {
          dayOfWeek: 1, // Segunda
          isClosed: false,
          startTime: '08:00',
          endTime: '18:00',
          lunchStartTime: '12:00',
          lunchEndTime: '13:00',
        },
        {
          dayOfWeek: 2, // Terça
          isClosed: false,
          startTime: '08:00',
          endTime: '18:00',
        },
        {
          dayOfWeek: 3, // Quarta
          isClosed: false,
          startTime: '08:00',
          endTime: '18:00',
        },
        {
          dayOfWeek: 4, // Quinta
          isClosed: false,
          startTime: '08:00',
          endTime: '18:00',
        },
        {
          dayOfWeek: 5, // Sexta
          isClosed: false,
          startTime: '08:00',
          endTime: '18:00',
        },
        {
          dayOfWeek: 6, // Sábado
          isClosed: false,
          startTime: '08:00',
          endTime: '12:00',
        },
        {
          dayOfWeek: 0, // Domingo
          isClosed: true,
        },
      ],
    };

    describe('PUT /api/v1/working-hours', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .put('/api/v1/working-hours')
          .send(weeklySchedule)
          .expect(401);
      });

      it('deve retornar 403 Forbidden para perfil CLIENT', async () => {
        await request(app.getHttpServer())
          .put('/api/v1/working-hours')
          .set('Authorization', `Bearer ${clientToken}`)
          .send(weeklySchedule)
          .expect(403);
      });

      it('deve atualizar com sucesso a grade semanal de funcionamento da empresa autenticada', async () => {
        const res = await request(app.getHttpServer())
          .put('/api/v1/working-hours')
          .set('Authorization', `Bearer ${owner1Token}`)
          .send(weeklySchedule)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(7);

        // AUDITORIA NO BANCO
        const hoursInDb = await prisma.workingHour.findMany({
          where: { companyId: owner1CompanyId },
        });
        expect(hoursInDb.length).toBe(7);
      });
    });

    describe('GET /api/v1/working-hours', () => {
      it('deve retornar 200 OK com os horários da empresa autenticada', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/working-hours')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(7);
      });
    });

    describe('GET /api/v1/working-hours/company/:id (Público)', () => {
      it('deve retornar 200 OK com a grade de funcionamento sem necessidade de autenticação', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/working-hours/company/${owner1CompanyId}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(7);
      });
    });

    describe('Schedule Exceptions Endpoints', () => {
      it('deve cadastrar uma exceção de agenda (feriado/folga)', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/working-hours/exceptions')
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({
            date: '2026-12-25',
            isClosed: true,
            description: 'Feriado de Natal',
          })
          .expect(201);

        expect(res.body).toHaveProperty('id');
        expect(res.body.description).toBe('Feriado de Natal');
        createdExceptionId = res.body.id;

        // AUDITORIA NO BANCO
        const exceptionInDb = await prisma.scheduleException.findUnique({
          where: { id: createdExceptionId },
        });
        expect(exceptionInDb?.companyId).toBe(owner1CompanyId);
      });

      it('deve listar exceções cadastradas da empresa', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/working-hours/exceptions')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((e: any) => e.id === createdExceptionId)).toBe(
          true,
        );
      });

      it('deve remover a exceção de agenda', async () => {
        await request(app.getHttpServer())
          .delete(`/api/v1/working-hours/exceptions/${createdExceptionId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        const exceptionInDb = await prisma.scheduleException.findUnique({
          where: { id: createdExceptionId },
        });
        expect(exceptionInDb?.isActive).toBe(false);
        expect(exceptionInDb?.disabledAt).not.toBeNull();
      });
    });
  });

  // =========================================================================
  // 2. DISPONIBILIDADE (AVAILABLE SLOTS)
  // =========================================================================
  describe('Availability Endpoints', () => {
    it('deve retornar 200 OK com slots disponíveis para uma data útil válida', async () => {
      // 2026-10-05 é uma Segunda-feira (dayOfWeek: 1, aberto 08:00 - 18:00 com almoço 12:00-13:00)
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/appointments/available-slots?companyId=${owner1CompanyId}&serviceId=${owner1ServiceId}&date=2026-10-05`,
        )
        .expect(200);

      expect(res.body).toHaveProperty('slots');
      expect(Array.isArray(res.body.slots)).toBe(true);
      expect(res.body.slots.length).toBeGreaterThan(0);
      expect(res.body.slots).toContain('08:00');
      expect(res.body.slots).toContain('08:30');
      // O horário das 12:00 e 12:30 está no intervalo de almoço e não deve estar disponível
      expect(res.body.slots).not.toContain('12:00');
      expect(res.body.slots).not.toContain('12:30');
    });

    it('deve retornar 400 Bad Request se a data não estiver no formato YYYY-MM-DD', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/appointments/available-slots?companyId=${owner1CompanyId}&serviceId=${owner1ServiceId}&date=05-10-2026`,
        )
        .expect(400);
    });
  });

  // =========================================================================
  // 3. AGENDAMENTOS (BOOKING, REGRAS DE NEGÓCIO E ANTI-IDOR)
  // =========================================================================
  describe('Appointments Endpoints', () => {
    describe('POST /api/v1/appointments (Criação de Reserva)', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/appointments')
          .send({
            companyId: owner1CompanyId,
            serviceId: owner1ServiceId,
            appointmentDate: '2026-10-05T12:00:00.000Z',
          })
          .expect(401);
      });

      it('deve criar agendamento com derivação server-side dos valores de sinal e taxa (Zero Trust)', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            companyId: owner1CompanyId,
            serviceId: owner1ServiceId,
            appointmentDate: '2026-10-05T12:00:00.000Z',
          })
          .expect(201);

        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('PENDING_PAYMENT');
        expect(res.body.companyId).toBe(owner1CompanyId);
        expect(res.body.serviceId).toBe(owner1ServiceId);
        expect(res.body.clientId).toBe(clientUserId);

        createdAppointmentId = res.body.id;

        // AUDITORIA NO BANCO DE DADOS:
        // Serviço custa R$ 50.00 com 50% de sinal => Sinal: R$ 25.00
        // Taxa da plataforma sobre R$ 25.00 (10% = 2.50, múltiplo de 0.25) => Taxa: R$ 2.50
        const apptInDb = await prisma.appointment.findUnique({
          where: { id: createdAppointmentId },
        });

        expect(apptInDb).not.toBeNull();
        expect(Number(apptInDb?.servicePrice)).toBe(50.0);
        expect(Number(apptInDb?.downPaymentAmount)).toBe(25.0);
        expect(Number(apptInDb?.platformFeeAmount)).toBe(2.5);
        expect(apptInDb?.status).toBe('PENDING_PAYMENT');
        expect(apptInDb?.expiresAt).toBeDefined();
      });
    });

    describe('GET /api/v1/appointments/company & /user', () => {
      it('deve listar os agendamentos do cliente autenticado', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/appointments/user')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(Array.isArray(res.body) || Array.isArray(res.body.data)).toBe(
          true,
        );
        const list = Array.isArray(res.body) ? res.body : res.body.data;
        expect(list.some((a: any) => a.id === createdAppointmentId)).toBe(true);
      });

      it('deve listar os agendamentos da empresa pertencente ao proprietário autenticado', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/appointments/company')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(Array.isArray(res.body) || Array.isArray(res.body.data)).toBe(
          true,
        );
        const list = Array.isArray(res.body) ? res.body : res.body.data;
        expect(list.some((a: any) => a.id === createdAppointmentId)).toBe(true);
      });

      it('não deve listar agendamentos do Tenant 1 para o proprietário Tenant 2 (Isolamento Multi-tenant)', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/appointments/company')
          .set('Authorization', `Bearer ${owner2Token}`)
          .expect(200);

        const list = Array.isArray(res.body) ? res.body : res.body.data;
        expect(list.some((a: any) => a.id === createdAppointmentId)).toBe(
          false,
        );
      });
    });

    // =======================================================================
    // 4. TRANSAÇÃO E PIX (INTEGRAÇÃO ASAAS & ZERO TRUST)
    // =======================================================================
    describe('POST /api/v1/transactions/pix/:appointmentId', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/transactions/pix/${createdAppointmentId}`)
          .expect(401);
      });

      it('deve retornar 403 Forbidden se outro usuário tentar pagar o agendamento do cliente (Anti-IDOR)', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/transactions/pix/${createdAppointmentId}`)
          .set('Authorization', `Bearer ${owner2Token}`)
          .expect(403);
      });

      it('deve gerar cobrança PIX com split e persistir Transação no banco', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/transactions/pix/${createdAppointmentId}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(201);

        expect(res.body).toHaveProperty('paymentId');
        expect(res.body).toHaveProperty('qrCodePayload');
        expect(res.body).toHaveProperty('qrCodeImage');

        // AUDITORIA NO BANCO: verifica persistência da transação
        const txInDb = await prisma.transaction.findFirst({
          where: { appointmentId: createdAppointmentId },
        });

        expect(txInDb).not.toBeNull();
        expect(txInDb?.status).toBe('PENDING');
        expect(Number(txInDb?.totalValue)).toBe(27.5); // R$ 25.00 sinal + R$ 2.50 taxa
      });
    });

    // =======================================================================
    // 5. TRANSIÇÕES DE STATUS E CANCELAMENTO
    // =======================================================================
    describe('Status Transitions & Cancellation Rules', () => {
      it('deve bloquear conclusão (complete) de agendamento que ainda está PENDING_PAYMENT', async () => {
        // Apenas agendamentos CONFIRMED podem ser concluídos
        await request(app.getHttpServer())
          .patch(`/api/v1/appointments/${createdAppointmentId}/complete`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(400);
      });

      it('deve bloquear conclusão por outro tenant (Anti-IDOR)', async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/appointments/${createdAppointmentId}/complete`)
          .set('Authorization', `Bearer ${owner2Token}`)
          .expect(403);
      });

      it('deve permitir cancelamento pelo cliente (deactivate)', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/api/v1/appointments/${createdAppointmentId}/client`)
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(res.body.status).toBe('CANCELED');

        // AUDITORIA NO BANCO
        const apptInDb = await prisma.appointment.findUnique({
          where: { id: createdAppointmentId },
        });
        expect(apptInDb?.status).toBe('CANCELED');
        expect(apptInDb?.isActive).toBe(false);
      });
    });
  });
});
