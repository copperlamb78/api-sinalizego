import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 0. Configurar Trust Proxy para resolução precisa de IP em rate limiters / Throttler
  app.set('trust proxy', 1);

  // 0.1 Aumentar limite de payload para suportar uploads de imagem em base64
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // 1. Headers de Segurança HTTP com Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // 2. Configuração Abrangente de CORS
  const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4200',
    'https://sinalizego.com',
    'https://app.sinalizego.com',
    'https://admin.sinalizego.com',
    'https://sinalizego.com.br',
    'https://app.sinalizego.com.br',
    'https://sinalizego.vercel.app',
  ];

  const allowedOrigins = rawCorsOrigins
    ? rawCorsOrigins.split(',').map((origin) => {
        const trimmed = origin.trim();
        try {
          const parsed = new URL(trimmed);
          return `${parsed.protocol}//${parsed.host}`;
        } catch {
          return trimmed.replace(/\/+$/, '');
        }
      })
    : defaultOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (mobile apps, Postman, webhooks do Asaas) ou origens explicitamente permitidas.
      // Nunca usar wildcard '*' ou regex em domínios compartilhados para evitar CORS spoofing
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`Origem ${origin} não permitida pelas políticas de CORS.`),
        );
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'asaas-access-token',
      'Accept',
    ],
  });

  // 3. Prefixo Global e Versionamento de Rotas
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

  // 4. Documentação Swagger (Oculta em produção a menos que explicitamente habilitada)
  const isProduction = process.env.NODE_ENV === 'production';
  const enableSwaggerInProd = process.env.ENABLE_SWAGGER_IN_PROD === 'true';

  if (!isProduction || enableSwaggerInProd) {
    const config = new DocumentBuilder()
      .setTitle('SinalizeGO API')
      .setDescription(
        'API RESTful do ecossistema SinalizeGO — Plataforma para gestão de agendamentos, vitrine pública, subcontas e split de pagamentos Pix via Asaas Sandbox.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag(
        'Autenticação',
        'Endpoints de login, renovação de tokens e recuperação de senha',
      )
      .addTag(
        'Usuários',
        'Gerenciamento de contas de clientes, prestadores e administradores',
      )
      .addTag(
        'Admin — Super Admin & Gestão Global',
        'Platform Intelligence, receita SaaS, GMV e moderação de empresas',
      )
      .addTag(
        'Empresas',
        'Cadastro, vitrine pública consolidada e dashboard financeiro do dono',
      )
      .addTag(
        'Serviços',
        'Catálogo de serviços por empresa com faixas progressivas e split',
      )
      .addTag(
        'Grupo de Serviços',
        'Organização de serviços com controle de capacidade concorrente',
      )
      .addTag(
        'Horários de Funcionamento',
        'Grade semanal de atendimento, intervalos e feriados/exceções',
      )
      .addTag(
        'Agendamentos',
        'Criação de reservas, motor de disponibilidade e conclusão de atendimentos',
      )
      .addTag(
        'Perfil Financeiro',
        'Subcontas Asaas Sandbox com credenciais criptografadas em repouso',
      )
      .addTag(
        'Transações',
        'Geração de cobranças Pix com split e conciliação financeira',
      )
      .addTag(
        'Uploads',
        'Upload seguro de imagens com validação binária de magic bytes',
      )
      .addTag(
        'Webhooks',
        'Processamento assíncrono e idempotente de notificações do Asaas',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    SwaggerModule.setup('api', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
