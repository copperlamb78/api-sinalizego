import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';

describe('HTTP & Financial Security (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/company/transactions (F-25)', () => {
    it('deve retornar 401 Unauthorized quando acessado sem token JWT', () => {
      return request(app.getHttpServer())
        .get('/api/v1/company/transactions')
        .expect(401)
        .expect((res) => {
          expect(res.body.statusCode).toBe(401);
          expect(res.body.message).toBe('Unauthorized');
          expect(res.body.path).toBe('/api/v1/company/transactions');
        });
    });
  });

  describe('POST /api/v1/company/withdraw (Saque Avulso)', () => {
    it('deve retornar 401 Unauthorized quando requisitado sem token JWT', () => {
      return request(app.getHttpServer())
        .post('/api/v1/company/withdraw')
        .send({ amount: 50.0 })
        .expect(401)
        .expect((res) => {
          expect(res.body.statusCode).toBe(401);
        });
    });
  });

  describe('POST /webhooks/asaas (F-18 / Segurança de Gateway)', () => {
    it('deve retornar 401 Unauthorized quando o token asaas-access-token for ausente', () => {
      return request(app.getHttpServer())
        .post('/webhooks/asaas')
        .send({ event: 'PAYMENT_RECEIVED' })
        .expect(401)
        .expect((res) => {
          expect(res.body.statusCode).toBe(401);
          expect(res.body.message).toContain('Token de webhook inválido');
        });
    });

    it('deve retornar 401 Unauthorized quando o token asaas-access-token for inválido', () => {
      return request(app.getHttpServer())
        .post('/webhooks/asaas')
        .set('asaas-access-token', 'token_fraudulento_123')
        .send({ event: 'PAYMENT_RECEIVED' })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/login (Validação de DTO)', () => {
    it('deve retornar 400 Bad Request com mensagens semânticas quando os campos forem omitidos', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.statusCode).toBe(400);
          expect(Array.isArray(res.body.message)).toBe(true);
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'O e-mail é obrigatório',
              'A senha é obrigatória',
            ]),
          );
        });
    });
  });

  describe('GET /api/v1/company/get-by-slug/:slug (Storefront Público)', () => {
    it('deve retornar 404 Not Found para estabelecimento inexistente', () => {
      return request(app.getHttpServer())
        .get('/api/v1/company/get-by-slug/empresa-inexistente-12345')
        .expect(404)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.message).toBe('Estabelecimento não encontrado.');
        });
    });
  });

  describe('GET /api/v1/admin/dashboard/metrics (Segurança de Métricas)', () => {
    it('deve retornar 401 Unauthorized quando requisitado sem credenciais de administrador', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/dashboard/metrics')
        .expect(401);
    });
  });
});
