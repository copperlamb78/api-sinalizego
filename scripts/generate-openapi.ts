import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from '../src/app.module';

const OUTPUT_DOCS = resolve(process.cwd(), 'docs', 'openapi.json');
const OUTPUT_ROOT = resolve(process.cwd(), 'openapi.json');

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['/', 'webhooks/asaas'],
  });

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

  mkdirSync(dirname(OUTPUT_DOCS), { recursive: true });
  const jsonContent = JSON.stringify(document, null, 2);
  writeFileSync(OUTPUT_DOCS, jsonContent, 'utf8');
  writeFileSync(OUTPUT_ROOT, jsonContent, 'utf8');

  const rotas = Object.keys(document.paths ?? {}).length;
  const schemas = Object.keys(document.components?.schemas ?? {}).length;
  console.log(`✅ OpenAPI gerado com sucesso:`);
  console.log(`   - docs/openapi.json`);
  console.log(`   - openapi.json`);
  console.log(`   - ${rotas} caminhos / endpoints`);
  console.log(`   - ${schemas} schemas / DTOs`);

  await app.close();
}

generate().catch((err) => {
  console.error('❌ Falha ao gerar o OpenAPI:', err);
  process.exit(1);
});
