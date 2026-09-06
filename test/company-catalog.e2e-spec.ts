import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AsaasService } from '../src/asaas/asaas.service';
import { MailService } from '../src/modules/mail/mail.service';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { Role } from '@prisma/client';

describe('Company, ServiceGroup, Services & Uploads HTTP E2E Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Mock de APIs externas (Zero chamadas externas conforme AGENTS.md §2)
  const mockAsaasService = {
    createCustomer: jest.fn().mockResolvedValue('cus_mock_123'),
    createSubAccount: jest.fn().mockResolvedValue({ id: 'sub_mock_123' }),
  };

  const mockMailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  };

  const mockCloudinaryService = {
    uploadImage: jest.fn().mockResolvedValue({
      secure_url:
        'https://res.cloudinary.com/sinalizego/image/upload/mock_img.jpg',
      public_id: 'sinalizego/mock_img',
    }),
  };

  const uniqueSuffix = Date.now().toString();
  const owner1Email = `owner1_${uniqueSuffix}@sinalizego.com`;
  const owner2Email = `owner2_${uniqueSuffix}@sinalizego.com`;
  const clientEmail = `client_${uniqueSuffix}@sinalizego.com`;

  let owner1UserId: string;
  let owner2UserId: string;
  let clientUserId: string;

  let owner1CompanyId: string;
  let owner2CompanyId: string;
  let owner1CompanySlug: string;

  let owner1Token: string;
  let owner2Token: string;
  let clientToken: string;

  let createdServiceGroupId: string;
  let createdServiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AsaasService)
      .useValue(mockAsaasService)
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .overrideProvider(CloudinaryService)
      .useValue(mockCloudinaryService)
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

    const hashedPassword = await bcrypt.hash('Password@123', 10);

    // 1. Cria Usuário e Empresa do Tenant 1
    const user1 = await prisma.user.create({
      data: {
        name: 'Proprietário 1 E2E',
        email: owner1Email,
        password: hashedPassword,
        phone: '11999991111',
        role: Role.COMPANY_OWNER,
        isActive: true,
      },
    });
    owner1UserId = user1.id;

    owner1CompanySlug = `empresa-1-${uniqueSuffix}`;
    const company1 = await prisma.company.create({
      data: {
        businessName: `Empresa 1 E2E ${uniqueSuffix}`,
        slug: owner1CompanySlug,
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

    // Vincula perfil financeiro para desbloquear trava de onboarding de serviços
    const finProfile1 = await prisma.financialProfile.create({
      data: {
        userId: owner1UserId,
        name: 'Proprietário 1 E2E',
        email: owner1Email,
        cpfCnpj: `111${Date.now().toString().slice(-8)}`,
        mobilePhone: '11999991111',
        incomeValue: 5000.0,
        address: 'Rua Principal',
        addressNumber: '10',
        province: 'Centro',
        postalCode: '01001000',
        walletId: `wallet_1_${uniqueSuffix}`,
        isActive: true,
      },
    });
    await prisma.company.update({
      where: { id: owner1CompanyId },
      data: { financialProfileId: finProfile1.id },
    });

    // 2. Cria Usuário e Empresa do Tenant 2 (para testes estritos de Anti-IDOR)
    const user2 = await prisma.user.create({
      data: {
        name: 'Proprietário 2 E2E',
        email: owner2Email,
        password: hashedPassword,
        phone: '11999992222',
        role: Role.COMPANY_OWNER,
        isActive: true,
      },
    });
    owner2UserId = user2.id;

    const company2 = await prisma.company.create({
      data: {
        businessName: `Empresa 2 E2E ${uniqueSuffix}`,
        slug: `empresa-2-${uniqueSuffix}`,
        userId: owner2UserId,
        providerType: 'BARBERSHOP',
        district: 'Bairro Novo',
        street: 'Avenida Secundária',
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
        name: 'Proprietário 2 E2E',
        email: owner2Email,
        cpfCnpj: `222${Date.now().toString().slice(-8)}`,
        mobilePhone: '11999992222',
        incomeValue: 5000.0,
        address: 'Avenida Secundária',
        addressNumber: '20',
        province: 'Bairro Novo',
        postalCode: '13010000',
        walletId: `wallet_2_${uniqueSuffix}`,
        isActive: true,
      },
    });
    await prisma.company.update({
      where: { id: owner2CompanyId },
      data: { financialProfileId: finProfile2.id },
    });

    // 3. Cria Usuário Cliente comum
    const clientUser = await prisma.user.create({
      data: {
        name: 'Cliente Comum E2E',
        email: clientEmail,
        password: hashedPassword,
        phone: '11999993333',
        role: Role.CLIENT,
        isActive: true,
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
      if (createdServiceId) {
        await prisma.service.deleteMany({ where: { id: createdServiceId } });
      }
      if (createdServiceGroupId) {
        await prisma.serviceGroup.deleteMany({
          where: { id: createdServiceGroupId },
        });
      }
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
      // Ignora falhas de cleanup
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // 1. EMPRESAS (COMPANY) ENDPOINTS
  // =========================================================================
  describe('Company Endpoints', () => {
    describe('POST /api/v1/company/create (Criação Pública)', () => {
      it('deve retornar 400 Bad Request se campos obrigatórios forem omitidos', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/company/create')
          .send({})
          .expect(400);
      });

      it('deve retornar 409 Conflict se tentar cadastrar com e-mail já existente', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/company/create')
          .send({
            name: 'Dono Duplicado',
            email: owner1Email,
            password: 'Password@123',
            phone: '11988880001',
            businessName: 'Barbearia Duplicada',
            providerType: 'BARBERSHOP',
            district: 'Centro',
            street: 'Rua das Flores',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01001000',
            number: '100',
          })
          .expect(409);
      });
    });

    describe('GET /api/v1/company/get-by-user-id (Dados da Empresa Autenticada)', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/company/get-by-user-id')
          .expect(401);
      });

      it('deve retornar 403 Forbidden para perfil CLIENT', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/company/get-by-user-id')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(403);
      });

      it('deve retornar 200 OK com os dados da empresa pertencente ao OWNER autenticado', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/company/get-by-user-id')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(res.body).toHaveProperty('id', owner1CompanyId);
        expect(res.body).toHaveProperty('businessName');
      });
    });

    describe('GET /api/v1/company/slug/:slug (Vitrine Pública)', () => {
      it('deve retornar 404 Not Found para slug inexistente', async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/company/slug/slug-inexistente-${uniqueSuffix}`)
          .expect(404);
      });

      it('deve retornar 200 OK com os dados públicos da empresa sem necessidade de autenticação', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/company/slug/${owner1CompanySlug}`)
          .expect(200);

        expect(res.body).toHaveProperty('slug', owner1CompanySlug);
        expect(res.body).toHaveProperty('businessName');
      });
    });

    describe('PATCH /api/v1/company/update/:companyId (Edição & Anti-IDOR)', () => {
      it('deve retornar 404 Not Found ao tentar atualizar empresa pertencente a outro usuário (Anti-IDOR)', async () => {
        await request(app.getHttpServer())
          .patch(`/api/v1/company/update/${owner2CompanyId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({ businessName: 'Nome Invasor' })
          .expect(404);
      });

      it('deve atualizar os dados da própria empresa com sucesso quando autenticado', async () => {
        const updatedName = `Barbearia Atualizada ${uniqueSuffix}`;
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/company/update/${owner1CompanyId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({ businessName: updatedName })
          .expect(200);

        expect(res.body.businessName).toBe(updatedName);

        // AUDITORIA NO BANCO
        const companyInDb = await prisma.company.findUnique({
          where: { id: owner1CompanyId },
        });
        expect(companyInDb?.businessName).toBe(updatedName);
      });
    });
  });

  // =========================================================================
  // 2. GRUPOS DE SERVIÇOS (SERVICE GROUP) ENDPOINTS
  // =========================================================================
  describe('ServiceGroup Endpoints', () => {
    describe('POST /api/v1/service-group', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/service-group')
          .send({
            name: 'Corte e Barba',
            capacity: 2,
            companyId: owner1CompanyId,
          })
          .expect(401);
      });

      it('deve retornar 403 Forbidden para perfil CLIENT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/service-group')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            name: 'Corte e Barba',
            capacity: 2,
            companyId: owner1CompanyId,
          })
          .expect(403);
      });

      it('deve criar novo grupo de serviços para a empresa do proprietário autenticado', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/service-group')
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({
            name: `Cabeleireiros ${uniqueSuffix}`,
            capacity: 3,
            companyId: owner1CompanyId,
          })
          .expect(201);

        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(`Cabeleireiros ${uniqueSuffix}`);
        expect(res.body.capacity).toBe(3);
        createdServiceGroupId = res.body.id;

        // AUDITORIA NO BANCO
        const groupInDb = await prisma.serviceGroup.findUnique({
          where: { id: createdServiceGroupId },
        });
        expect(groupInDb).not.toBeNull();
        expect(groupInDb?.capacity).toBe(3);
      });
    });

    describe('GET /api/v1/service-group (Listagem)', () => {
      it('deve retornar 200 OK com os grupos de serviços da empresa', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/service-group')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((g: any) => g.id === createdServiceGroupId)).toBe(
          true,
        );
      });
    });

    describe('GET /api/v1/service-group/:id (Anti-IDOR)', () => {
      it('deve retornar 404/403 se o Tenant 2 tentar consultar grupo de serviço do Tenant 1', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/service-group/${createdServiceGroupId}`)
          .set('Authorization', `Bearer ${owner2Token}`);

        expect([403, 404]).toContain(res.status);
      });

      it('deve retornar 200 OK quando consultado pelo próprio dono do recurso', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/service-group/${createdServiceGroupId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(res.body.id).toBe(createdServiceGroupId);
      });
    });

    describe('PATCH /api/v1/service-group/:id (Atualização & Anti-IDOR)', () => {
      it('deve bloquear edição por tenant concorrente (Anti-IDOR)', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/service-group/${createdServiceGroupId}`)
          .set('Authorization', `Bearer ${owner2Token}`)
          .send({ name: 'Nome Invasor' });

        expect([403, 404]).toContain(res.status);
      });

      it('deve atualizar capacidade e nome do grupo de serviço pelo dono', async () => {
        const updatedGroupName = `Cabeleireiros Pro ${uniqueSuffix}`;
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/service-group/${createdServiceGroupId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({ name: updatedGroupName, capacity: 4 })
          .expect(200);

        expect(res.body.name).toBe(updatedGroupName);
        expect(res.body.capacity).toBe(4);

        // AUDITORIA NO BANCO
        const groupInDb = await prisma.serviceGroup.findUnique({
          where: { id: createdServiceGroupId },
        });
        expect(groupInDb?.capacity).toBe(4);
      });
    });
  });

  // =========================================================================
  // 3. CATÁLOGO DE SERVIÇOS (COMPANY-SERVICE) ENDPOINTS
  // =========================================================================
  describe('CompanyService Endpoints', () => {
    describe('POST /api/v1/company-service/create', () => {
      it('deve retornar 401 Unauthorized sem token JWT', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/company-service/create')
          .send({})
          .expect(401);
      });

      it('deve retornar 400 Bad Request se campos obrigatórios forem omitidos', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/company-service/create')
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({})
          .expect(400);
      });

      it('deve criar novo serviço vinculado ao serviceGroupId e calcular sinal no banco', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/company-service/create')
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({
            name: `Corte Degradê ${uniqueSuffix}`,
            description: 'Corte moderno com navalha',
            durationMinutes: 45,
            totalPrice: 50.0,
            downPaymentPercent: 50,
            serviceGroupId: createdServiceGroupId,
          })
          .expect(201);

        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(`Corte Degradê ${uniqueSuffix}`);
        expect(Number(res.body.totalPrice)).toBe(50.0);
        createdServiceId = res.body.id;

        // AUDITORIA NO BANCO: verifica persistência de valores Decimal
        const serviceInDb = await prisma.service.findUnique({
          where: { id: createdServiceId },
        });
        expect(serviceInDb).not.toBeNull();
        expect(Number(serviceInDb?.totalPrice)).toBe(50.0);
        expect(serviceInDb?.serviceGroupId).toBe(createdServiceGroupId);
      });
    });

    describe('GET /api/v1/company-service/list', () => {
      it('deve retornar 200 OK com os serviços da empresa logada', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/company-service/list')
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((s: any) => s.id === createdServiceId)).toBe(true);
      });
    });

    describe('GET /api/v1/company-service/list/:slug (Vitrine Pública)', () => {
      it('deve retornar 200 OK com catálogo público da empresa por slug', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/company-service/list/${owner1CompanySlug}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe('PATCH /api/v1/company-service/update/:id (Anti-IDOR)', () => {
      it('deve bloquear edição por tenant concorrente (Anti-IDOR)', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/company-service/update/${createdServiceId}`)
          .set('Authorization', `Bearer ${owner2Token}`)
          .send({ totalPrice: 99.0 });

        expect([403, 404]).toContain(res.status);
      });

      it('deve atualizar preço e duração pelo próprio proprietário', async () => {
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/company-service/update/${createdServiceId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({ totalPrice: 65.0, durationMinutes: 50 })
          .expect(200);

        expect(Number(res.body.totalPrice)).toBe(65.0);
        expect(res.body.durationMinutes).toBe(50);

        // AUDITORIA NO BANCO
        const serviceInDb = await prisma.service.findUnique({
          where: { id: createdServiceId },
        });
        expect(Number(serviceInDb?.totalPrice)).toBe(65.0);
      });
    });

    describe('DELETE /api/v1/company-service/deactivate/:id', () => {
      it('deve bloquear desativação por outro tenant (Anti-IDOR)', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/api/v1/company-service/deactivate/${createdServiceId}`)
          .set('Authorization', `Bearer ${owner2Token}`);

        expect([403, 404]).toContain(res.status);
      });

      it('deve desativar o serviço com soft delete (isActive: false) pelo dono', async () => {
        const res = await request(app.getHttpServer())
          .delete(`/api/v1/company-service/deactivate/${createdServiceId}`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .expect(200);

        expect(res.body.isActive).toBe(false);

        // AUDITORIA NO BANCO
        const serviceInDb = await prisma.service.findUnique({
          where: { id: createdServiceId },
        });
        expect(serviceInDb?.isActive).toBe(false);
      });
    });
  });

  // =========================================================================
  // 4. UPLOADS (CLOUDINARY) ENDPOINTS
  // =========================================================================
  describe('Uploads Endpoints (Anti-IDOR & Magic Bytes)', () => {
    // Buffer simulando cabeçalho de imagem JPEG real (Magic bytes: FF D8 FF)
    const validJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00,
    ]);

    // Buffer inválido (texto simulando script executável falso)
    const fakeScriptBuffer = Buffer.from('<?php echo "malicious script"; ?>');

    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/upload/image/${owner1CompanyId}/logo`)
        .attach('file', validJpegBuffer, 'logo.jpg')
        .expect(401);
    });

    it('deve retornar 403 Forbidden se o Tenant 2 tentar fazer upload para empresa do Tenant 1 (Anti-IDOR)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/upload/image/${owner1CompanyId}/logo`)
        .set('Authorization', `Bearer ${owner2Token}`)
        .attach('file', validJpegBuffer, 'logo.jpg')
        .expect(403);
    });

    it('deve retornar 400 Bad Request se nenhum arquivo for enviado', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/upload/image/${owner1CompanyId}/logo`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .expect(400);
    });

    it('deve retornar 400 Bad Request ao enviar arquivo que falha na validação de magic bytes', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/upload/image/${owner1CompanyId}/logo`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .attach('file', fakeScriptBuffer, 'fake.jpg')
        .expect(400);
    });

    it('deve realizar upload com sucesso para logo com magic bytes válidos', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/upload/image/${owner1CompanyId}/logo`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .attach('file', validJpegBuffer, 'logo.jpg')
        .expect(201);

      expect(res.body).toHaveProperty('url');
      expect(res.body.url).toBe(
        'https://res.cloudinary.com/sinalizego/image/upload/mock_img.jpg',
      );
      expect(res.body).toHaveProperty('publicId');
      expect(mockCloudinaryService.uploadImage).toHaveBeenCalled();
    });
  });
});
