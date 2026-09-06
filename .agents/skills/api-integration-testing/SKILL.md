---
name: api-integration-testing
description: >-
  Diretrizes e padrão de execução para testes de integração HTTP (E2E) usando
  Jest e Supertest no NestJS da API SinalizeGO. Use sempre que for criar ou
  validar novos endpoints, verificar o ciclo completo de requisições HTTP,
  validar persistência e integridade no banco de dados via Prisma, testar
  segurança RBAC e isolamento multi-tenancy (401, 403, 404, IDOR).
---

# Padrão de Testes de Integração HTTP (E2E) com Jest & Supertest

Este documento estabelece o padrão obrigatório para validação de endpoints HTTP, segurança e persistência no banco de dados antes da entrega de novas funcionalidades na API SinalizeGO.

---

## 🎯 Princípios Fundamentais

1. **Pipeline HTTP Completo**: Toda validação HTTP deve atravessar os pipes globais (`ValidationPipe` com `whitelist: true`), guards (`JwtAuthGuard`, `RolesGuard`), interceptors e filtros globais (`AllExceptionsFilter`).
2. **Validação no Banco de Dados (Prisma)**: Não basta validar a resposta JSON da rota; o teste deve inspecionar as tabelas no Prisma para garantir que o estado persistido (ex: enums, campos decimais, status e timestamps) condiz rigorosamente com o esperado.
3. **Matriz de Erros de Acesso & Segurança (RBAC & IDOR)**:
   - **401 Unauthorized**: Requisições sem token JWT, com token expirado ou malformado.
   - **403 Forbidden**: Token válido pertencente a role não autorizada (ex: `CLIENT` tentando acessar rota `@Roles(...INTERNAL_NO_EMPLOYEE)`).
   - **404 Not Found (Anti-IDOR)**: Tentar acessar ou modificar recurso de outro tenant/estabelecimento.
4. **Validação de DTOs & Semântica**:
   - **400 Bad Request**: Campos obrigatórios ausentes, tipos incorretos ou regras de formato violadas (ex: CPF, slug, data).
   - **409 Conflict**: Tentativa de duplicação de chave única (e-mail, slug, vaga já ocupada).
5. **Zero Chamadas Externas Reais**: Gateways terceiros (`AsaasService`, `MailService` via Brevo, `CloudinaryService`) devem ser mockados no módulo de teste para evitar efeitos colaterais e custos externos.

---

## 🏗️ Estrutura Canônica de um Teste E2E

### 1. Inicialização do NestJS Application

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

describe('NomeDoModulo HTTP Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Mocks de serviços externos (se necessário sobrescrever)
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
  });

  afterAll(async () => {
    await app.close();
  });
});
```

### 2. Geração de Tokens para Matriz RBAC

Para testar autorização sem depender de requisições de login em cada teste, gere os tokens JWT programaticamente:

```typescript
function generateTestToken(userId: string, email: string, role: Role): string {
  return jwtService.sign(
    { sub: userId, email, role },
    { secret: process.env.JWT_SECRET || 'test_secret', expiresIn: '1h' },
  );
}

const clientToken = generateTestToken('user-client-1', 'client@test.com', Role.CLIENT);
const ownerToken = generateTestToken('user-owner-1', 'owner@test.com', Role.COMPANY_OWNER);
const adminToken = generateTestToken('user-admin-1', 'admin@test.com', Role.ADMIN);
```

---

## 📋 Roteiro de Validação por Endpoint

Para cada novo endpoint ou fluxo de negócio:

### A. Validação de Acesso (Segurança)
- [ ] Enviar requisição **sem cabeçalho `Authorization`** -> Esperar **401 Unauthorized**.
- [ ] Enviar requisição com token de role não autorizada -> Esperar **403 Forbidden**.
- [ ] Enviar requisição apontando para `companyId` ou recurso de outro usuário -> Esperar **404 Not Found** (isolamento de tenant).

### B. Validação de Payload (DTO)
- [ ] Enviar payload vazio (`{}`) -> Esperar **400 Bad Request** com lista de campos faltantes.
- [ ] Enviar campos extras não declarados no DTO -> Confirmar que são descartados pelo `whitelist: true`.
- [ ] Enviar tipos inválidos (ex: string em campo numérico, formato de data inválido) -> Esperar **400 Bad Request**.

### C. Validação de Sucesso (Happy Path) & Banco de Dados
- [ ] Enviar requisição válida com credenciais corretas -> Esperar **200 OK** ou **201 Created**.
- [ ] Validar estrutura do corpo de resposta JSON (campos esperados presentes, campos sensíveis omitidos).
- [ ] **Auditar no Banco de Dados (`prisma.<model>.findUnique`)**:
  - Verificar se o registro foi inserido/alterado.
  - Verificar se valores numéricos e `Decimal` batem exatamente.
  - Verificar se os status e enums foram gravados corretamente.
  - Verificar preenchimento correto de chaves estrangeiras (`companyId`, `userId`, etc.).

---

## 🧪 Comandos de Execução

Para rodar especificamente a suíte de testes de integração HTTP:

```bash
# Executa todos os testes e2e
npm run test:e2e

# Executa um arquivo e2e específico
npx jest --config ./test/jest-e2e.json test/promotions.e2e-spec.ts --runInBand
```
