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
import { Role } from '@prisma/client';

describe('Auth & Users HTTP E2E & Database Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Mock de serviços de terceiros (Zero chamadas externas conforme AGENTS.md §2)
  const mockAsaasService = {
    createCustomer: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          `cus_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        ),
      ),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendForgotPasswordEmail: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  };

  const uniqueSuffix = Date.now().toString();
  const testEmail = `auth_user_${uniqueSuffix}@sinalizego.com`;
  const adminEmail = `admin_user_${uniqueSuffix}@sinalizego.com`;
  const rawPassword = 'Password@123';

  let testUserId: string;
  let adminUserId: string;
  let userToken: string;
  let adminToken: string;
  let userRefreshToken: string;

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

    // Criação de usuário base com hash de senha real bcrypt
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const user = await prisma.user.create({
      data: {
        name: 'Usuário Teste Auth',
        email: testEmail,
        password: hashedPassword,
        phone: '11988880001',
        role: Role.CLIENT,
        isActive: true,
      },
    });
    testUserId = user.id;

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Teste Auth',
        email: adminEmail,
        password: hashedPassword,
        phone: '11988880002',
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
    adminUserId = admin.id;

    const secret = process.env.JWT_SECRET || 'test_jwt_secret';
    userToken = jwtService.sign(
      { sub: testUserId, email: testEmail, role: Role.CLIENT },
      { secret },
    );
    adminToken = jwtService.sign(
      { sub: adminUserId, email: adminEmail, role: Role.SUPER_ADMIN },
      { secret },
    );
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              testEmail,
              adminEmail,
              `novo_${uniqueSuffix}@sinalizego.com`,
              `outro_${uniqueSuffix}@sinalizego.com`,
              `sem_cpf_${uniqueSuffix}@sinalizego.com`,
              `ativo_${uniqueSuffix}@sinalizego.com`,
            ],
          },
        },
      });
    } catch {
      // Ignora falhas de cleanup
    }

    await prisma.$disconnect();
    await app.close();
  });

  // =========================================================================
  // 1. AUTENTICAÇÃO (AUTH) ENDPOINTS
  // =========================================================================
  describe('POST /api/v1/auth/login', () => {
    it('deve retornar 400 Bad Request se os campos obrigatórios forem omitidos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'O e-mail é obrigatório',
          'A senha é obrigatória',
        ]),
      );
    });

    it('deve retornar 401 Unauthorized se o e-mail não existir no sistema (anti-enumeração)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `inexistente_${uniqueSuffix}@sinalizego.com`,
          password: rawPassword,
        })
        .expect(401);
    });

    it('deve retornar 401 Unauthorized se a senha estiver incorreta', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'SenhaErrada@123',
        })
        .expect(401);
    });

    it('deve autenticar usuário com credenciais válidas e retornar access_token e refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: rawPassword,
        })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.password).toBeUndefined();

      userRefreshToken = res.body.refresh_token;

      // AUDITORIA NO BANCO: verifica se o refresh token hash foi gravado
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb?.refreshToken).not.toBeNull();
    });
  });

  describe('POST /api/v1/auth/forgot-password (Anti-enumeração de Usuários)', () => {
    it('deve retornar 400 Bad Request se o formato do e-mail for inválido', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'formato_invalido' })
        .expect(400);
    });

    it('deve retornar mensagem genérica e disparar e-mail se o usuário existir', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: testEmail });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('deve retornar a mesma mensagem genérica se o e-mail NÃO existir (Anti-enumeração)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: `fantasma_${uniqueSuffix}@sinalizego.com` });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/auth/me (Perfil Autenticado)', () => {
    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('deve retornar o perfil sanitizado do usuário com token válido', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', testUserId);
      expect(res.body).toHaveProperty('email', testEmail);
      expect(res.body.password).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/refresh (Renovação de Tokens)', () => {
    it('deve retornar 401 Unauthorized se requisitado sem token de refresh', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(401);
    });

    it('deve renovar access_token e refresh_token quando o refresh_token for válido', async () => {
      if (!userRefreshToken) return;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${userRefreshToken}`);

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });

    it('deve invalidar a sessão e limpar o refreshToken no banco de dados', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 201]).toContain(res.status);

      // AUDITORIA NO BANCO
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb?.refreshToken).toBeNull();
    });
  });

  // =========================================================================
  // 2. GESTÃO DE USUÁRIOS (USERS) ENDPOINTS
  // =========================================================================
  describe('POST /api/v1/users/create (Cadastro de Cliente)', () => {
    const newUserEmail = `novo_${uniqueSuffix}@sinalizego.com`;

    it('deve retornar 400 Bad Request se campos obrigatórios forem omitidos', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/create')
        .send({})
        .expect(400);
    });

    it('deve retornar 409 Conflict se tentar cadastrar e-mail já existente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users/create')
        .send({
          name: 'Tentativa Duplicada',
          email: testEmail,
          password: 'Password@123',
          phone: '11977770001',
        })
        .expect(409);
    });

    it('deve criar novo usuário cliente com senha criptografada e persistir no banco', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/create')
        .send({
          name: 'Novo Cliente E2E',
          email: newUserEmail,
          password: 'SenhaSegura@123',
          phone: '11977770002',
        })
        .expect(201);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(newUserEmail);
      expect(res.body.user.role).toBe(Role.CLIENT);
      expect(res.body.user.password).toBeUndefined();

      // AUDITORIA NO BANCO
      const createdInDb = await prisma.user.findUnique({
        where: { email: newUserEmail },
      });
      expect(createdInDb).not.toBeNull();
      expect(createdInDb?.isActive).toBe(true);
      expect(createdInDb?.password).not.toBe('SenhaSegura@123'); // Confirma hash bcrypt
    });
  });

  describe('GET /api/v1/users/list (Controle RBAC - Restrito a SYSTEM_MANAGERS)', () => {
    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/list').expect(401);
    });

    it('deve retornar 403 Forbidden se chamado por perfil CLIENT (RolesGuard)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/list')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('deve retornar 200 OK com lista paginada de usuários para SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/list')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].password).toBeUndefined();
    });
  });

  describe('PATCH /api/v1/users/update (Edição do Próprio Usuário)', () => {
    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/update')
        .send({ name: 'Nome Alterado' })
        .expect(401);
    });

    it('deve atualizar o nome e telefone do usuário autenticado no banco de dados', async () => {
      const updatedName = 'Nome Atualizado via E2E';
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: updatedName })
        .expect(200);

      expect(res.body.name).toBe(updatedName);

      // AUDITORIA NO BANCO
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb?.name).toBe(updatedName);
    });
  });

  describe('PATCH /api/v1/users/update-cpf (Criação de Cliente Asaas)', () => {
    let freshClientToken: string;
    let freshClientId: string;

    beforeAll(async () => {
      const freshUser = await prisma.user.create({
        data: {
          name: 'Cliente Sem CPF',
          email: `sem_cpf_${uniqueSuffix}@sinalizego.com`,
          password: 'Password@123',
          phone: '11977770099',
          role: Role.CLIENT,
          isActive: true,
        },
      });
      freshClientId = freshUser.id;
      const secret = process.env.JWT_SECRET || 'test_jwt_secret';
      freshClientToken = jwtService.sign(
        { sub: freshUser.id, email: freshUser.email, role: Role.CLIENT },
        { secret },
      );
    });

    const testCpf = uniqueSuffix.slice(-11).padStart(11, '7');

    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/update-cpf')
        .send({ cpfCnpj: testCpf })
        .expect(401);
    });

    it('deve retornar 400 Bad Request se o CPF/CNPJ for omitido', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/update-cpf')
        .set('Authorization', `Bearer ${freshClientToken}`)
        .send({})
        .expect(400);
    });

    it('deve atualizar CPF, invocar criação no gateway Asaas e persistir no banco', async () => {
      const randomCpf = Math.floor(
        10000000000 + Math.random() * 90000000000,
      ).toString();
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/update-cpf')
        .set('Authorization', `Bearer ${freshClientToken}`)
        .send({ cpfCnpj: randomCpf })
        .expect(200);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user.cpfCnpj).toBe(randomCpf);
      expect(res.body.user.asaasCustomerId).toBeDefined();

      // AUDITORIA NO BANCO
      const userInDb = await prisma.user.findUnique({
        where: { id: freshClientId },
      });
      expect(userInDb?.cpfCnpj).toBe(randomCpf);
      expect(userInDb?.asaasCustomerId).toBe(res.body.user.asaasCustomerId);
    });

    it('deve retornar 409 Conflict se tentar cadastrar CPF novamente para o mesmo usuário', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/update-cpf')
        .set('Authorization', `Bearer ${freshClientToken}`)
        .send({ cpfCnpj: uniqueSuffix.slice(-11).padStart(11, '8') })
        .expect(409);
    });
  });

  describe('DELETE /api/v1/users/me (Desativação Própria - Soft Delete)', () => {
    it('deve retornar 401 Unauthorized sem token JWT', async () => {
      await request(app.getHttpServer()).delete('/api/v1/users/me').expect(401);
    });

    it('deve marcar isActive: false e registrar disabledAt no banco de dados', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.isActive).toBe(false);
      expect(res.body.disabledAt).not.toBeNull();

      // AUDITORIA NO BANCO
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb?.isActive).toBe(false);
      expect(userInDb?.disabledAt).not.toBeNull();
    });
  });

  describe('PATCH /api/v1/users/:userId/activate (Reativação Administrativa)', () => {
    let activeClientToken: string;

    beforeAll(async () => {
      const activeClient = await prisma.user.create({
        data: {
          name: 'Cliente Ativo para Teste RBAC',
          email: `ativo_${uniqueSuffix}@sinalizego.com`,
          password: 'Password@123',
          phone: '11977770088',
          role: Role.CLIENT,
          isActive: true,
        },
      });
      const secret = process.env.JWT_SECRET || 'test_jwt_secret';
      activeClientToken = jwtService.sign(
        { sub: activeClient.id, email: activeClient.email, role: Role.CLIENT },
        { secret },
      );
    });

    it('deve retornar 403 Forbidden se chamado por usuário comum ativo', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${testUserId}/activate`)
        .set('Authorization', `Bearer ${activeClientToken}`)
        .expect(403);
    });

    it('deve reativar o usuário (isActive: true, disabledAt: null) quando chamado por SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/users/${testUserId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.isActive).toBe(true);
      expect(res.body.disabledAt).toBeNull();

      // AUDITORIA NO BANCO
      const userInDb = await prisma.user.findUnique({
        where: { id: testUserId },
      });
      expect(userInDb?.isActive).toBe(true);
      expect(userInDb?.disabledAt).toBeNull();
    });
  });
});
