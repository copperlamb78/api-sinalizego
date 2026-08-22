/* eslint-disable @typescript-eslint/no-floating-promises */
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Headers de Segurança HTTP com Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // 2. Configuração Estrita de CORS
  const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.FRONTEND_URL;
  const allowedOrigins = rawCorsOrigins
    ? rawCorsOrigins.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4200',
        'https://sinalizego.com',
        'https://app.sinalizego.com',
        'https://admin.sinalizego.com',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (mobile apps, Postman, webhooks do Asaas) ou origens na lista
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*')
      ) {
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

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

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
      .setDescription('API para o ecossistema SinalizeGO')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
