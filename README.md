<div align="center">

# 🟢 SinalizeGO API

<img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" /> <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" /> <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" /> <img src="https://img.shields.io/badge/Brevo-0B996F?style=for-the-badge&logo=brevo&logoColor=white" /> <img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" />

**Plataforma de agendamento inteligente para empresas e prestadores de serviços**

*Conectando clientes às melhores empresas da sua região* ✨

---

[📖 Documentação](#-documentação-da-api) · [🚀 Começando](#-começando) · [📦 Módulos](#-módulos) · [🗄️ Banco de Dados](#️-banco-de-dados) · [🔑 Permissões](#-sistema-de-permissões) · [🧪 Testes Unitários](#-testes-unitários)

</div>

---

## 📋 Sobre o Projeto

**SinalizeGO** é uma API RESTful robusta e segura para gerenciamento de agendamentos entre **clientes** e **empresas/prestadores de serviços** (barbearias, estúdios, salões e mais). A plataforma permite que donos de empresa cadastrem seus negócios (`Company`), criem subcontas financeiras no Asaas Sandbox com split de pagamentos via Pix, organizem serviços em grupos de atendimento (`ServiceGroup`) com limite de capacidade, recuperem senhas de forma stateless via JWT dinâmico e e-mail transacional Brevo, e recebam agendamentos com confirmação em tempo real via Webhook.

### ✨ Destaques & Segurança

| Recurso | Descrição |
|---------|-----------|
| 🔐 **Autenticação JWT** | Login seguro com access token + refresh token |
| 🔑 **RBAC (Role-Based Access Control)** | Níveis de permissão com guard customizado (CLIENT, COMPANY_OWNER, EMPLOYEE, ADMIN, SUPER_ADMIN) |
| 🛡️ **Proteção Multi-tenancy & IDOR** | Validação estrita de posse de empresa e filtros travados pelo `userId` autenticado |
| 🔄 **Recuperação de Senha Stateless** | Token JWT assinado com chave dinâmica (`JWT_SECRET + user.password`) com expiração de 15min e invalidação imediata pós-uso |
| ✉️ **E-mails Transacionais (Brevo)** | Módulo de e-mail integrado com `@getbrevo/brevo` e templates HTML responsivos centralizados |
| 👥 **Gestão de Usuários Segura** | Sanitização centralizada com `USER_PUBLIC_SELECT` (sem vazamento de hashes/tokens), alteração de senha autenticada e vínculo de CPF/CNPJ ao Asaas |
| 🏢 **Perfil da Empresa (Company)** | Criação com slug automático, filtros, ordenação e ativação |
| 📁 **Grupos de Serviços (ServiceGroup)** | Organização de serviços por grupos com limite de capacidade, validação de posse e soft delete protegido |
| 💈 **Catálogo & Taxas Progressivas** | CRUD completo de serviços com taxa de plataforma calculada por faixas progressivas cumulativas (15% até R$ 50, 10% até R$ 250, 5% acima) com piso mínimo de R$ 2,00 |
| 📅 **Agendamentos Blindados** | Verificação de capacidade, bloqueio de confirmação manual não-paga e auditoria de cancelamento |
| 💳 **Perfil Financeiro & Split (Asaas)** | Criação de subcontas no Asaas Sandbox e cobranças Pix com split para a carteira da empresa derivadas 100% do banco |
| ⚡ **Webhooks em Tempo Real** | Processamento automático dos eventos `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED` para aprovar agendamentos |
| 🧪 **Suíte de Testes Completa** | Mais de 280 testes unitários cobrindo todos os módulos, controllers, services, helpers, regras financeiras e permissões |
| 📖 **Swagger UI** | Documentação interativa em `/api` |

---

## 🚀 Começando

### Pré-requisitos

```
Node.js >= 18
PostgreSQL (Supabase)
npm ou yarn
```

### Instalação

```bash
# 1️⃣ Clone o repositório
git clone https://github.com/copperlamb78/api-sinalizego.git
cd api-sinalizego

# 2️⃣ Instale as dependências
npm install

# 3️⃣ Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais (DATABASE_URL, JWT_SECRET, BREVO_API_KEY, ASAAS_API_KEY, etc.)

# 4️⃣ Gere o Prisma Client
npx prisma generate

# 5️⃣ Execute as migrations
npx prisma migrate deploy

# 6️⃣ Inicie o servidor
npm run start:dev
```

### ⚙️ Variáveis de Ambiente

```env
PORT=3000
NODE_ENV="development"

# Conexão com Banco de Dados PostgreSQL
DATABASE_URL="postgresql://postgres:password123@localhost:5432/sinalizego?schema=public"

# Autenticação e Criptografia
JWT_SECRET="super_secret_jwt_access_key"
JWT_REFRESH_SECRET="super_secret_jwt_refresh_key"
ENCRYPTION_SECRET="super_secret_encryption_key_32_characters_minimum"

# Frontend & CORS
FRONTEND_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
ENABLE_SWAGGER_IN_PROD="false"

# Gateway Asaas
ASAAS_API_URL="https://sandbox.asaas.com/api/v3"
ASAAS_API_KEY="$aact_YTU5YTE0M2..."
ASAAS_PIX_FEE=0.99
ASAAS_WEBHOOK_URL="https://api.sinalizego.com/api/v1/webhooks/asaas"
ASAAS_WEBHOOK_EMAIL="neodevzone@gmail.com"
ASAAS_WEBHOOK_TOKEN="asaas_webhook_secret_token_123456"

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"

# Brevo (E-mails Transacionais)
BREVO_API_KEY="xkeysib-..."
MAIL_FROM_EMAIL="neodevzone@gmail.com"
MAIL_FROM_NAME="SinalizeGO Suporte"
```

### 🏃 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run start:dev` | 🔄 Inicia em modo watch (desenvolvimento) |
| `npm run start:debug` | 🐛 Inicia em modo debug com watch |
| `npm run build` | 📦 Compila o projeto com o compilador NestJS |
| `npm run start:prod` | 🚀 Inicia a build de produção compilada |
| `npm run lint` | 🔍 Executa o linter (ESLint) com correção automática |
| `npm run format` | 🎨 Formata o código (Prettier) |
| `npm run test` | 🧪 Executa a suíte de testes unitários |
| `npm run test:watch` | 🧪 Executa os testes em modo interativo/watch |
| `npm run test:cov` | 📊 Gera relatório de cobertura de testes |

---

## 🔑 Sistema de Permissões

A API utiliza **RBAC (Role-Based Access Control)** com níveis de permissão e grupos predefinidos em `src/common/constants/role-groups.constant.ts`.

### Roles

| Role | Descrição |
|------|-----------|
| `CLIENT` | Usuário padrão que agenda serviços |
| `COMPANY_OWNER` | Dono de empresa / negócio |
| `EMPLOYEE` | Funcionário de uma empresa |
| `ADMIN` | Administrador do sistema |
| `SUPER_ADMIN` | Administrador com acesso total |

### Grupos de Permissão

| Grupo | Roles incluídas | Uso |
|-------|-----------------|-----|
| `SYSTEM_MANAGERS` | ADMIN, SUPER_ADMIN | Gestão do sistema (listar usuários, listagens globais) |
| `INTERNAL_USERS` | COMPANY_OWNER, EMPLOYEE, ADMIN, SUPER_ADMIN | Operações internas de consulta |
| `INTERNAL_NO_EMPLOYEE` | COMPANY_OWNER, ADMIN, SUPER_ADMIN | Operações administrativas sem funcionário (criação/alteração) |
| `ALL_USERS` | CLIENT, COMPANY_OWNER, EMPLOYEE, ADMIN, SUPER_ADMIN | Acesso geral autenticado |

---

## 📦 Módulos

### 🔐 Auth — Autenticação & Recuperação de Senha

> Gerenciamento de login com JWT, refresh token, e recuperação de senha stateless via e-mail Brevo.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `POST` | `/auth/login` | Login com email e senha | ❌ | — |
| `POST` | `/auth/refresh` | Renovar access token com refresh token | 🔑 Refresh | — |
| `GET` | `/auth/me` | Dados do usuário logado | 🔑 JWT | — |
| `POST` | `/auth/logout` | Encerrar sessão e invalidar refresh token | 🔑 JWT | — |
| `POST` | `/auth/forgot-password` | Solicitar link de recuperação de senha por e-mail | ❌ | — |
| `POST` | `/auth/reset-password` | Redefinir senha com token dinâmico stateless | ❌ | — |

---

### 👥 Users — Usuários

> CRUD completo com sanitização de campos sensíveis (`USER_PUBLIC_SELECT`), alteração de senha autenticada, ativação/desativação e vínculo com Asaas.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `POST` | `/users/create` | Criar novo usuário | ❌ | — |
| `GET` | `/users/list` | Listar todos os usuários (sem senhas/tokens) | 🔑 JWT | `SYSTEM_MANAGERS` |
| `PATCH` | `/users/update` | Atualizar dados cadastrais (nome, telefone) | 🔑 JWT | — |
| `PATCH` | `/users/change-password` | Alterar senha mediante confirmação da senha atual | 🔑 JWT | — |
| `PATCH` | `/users/update-cpf` | Atualizar CPF/CNPJ e gerar Customer ID Asaas | 🔑 JWT | — |
| `DELETE` | `/users/deactivate/:userId` | Desativar usuário (soft delete) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `PATCH` | `/users/activate/:userId` | Reativar usuário | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |

---

### 🏢 Company — Empresas & Vitrine Pública (Storefront)

> Cadastro de empresas com slug automático, consulta pública de storefront consolidado (`GET /company/slug/:slug`) trazendo dados do negócio, grade de horários (`workingHours`) e catálogo de serviços agrupados (`serviceGroups` e `services`), busca por ID, filtros, ordenação e ativação/desativação.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `GET` | `/company/slug/:slug` | Consultar perfil público do estabelecimento (Storefront consolidado) | ❌ | — |
| `GET` | `/company/get-by-slug/:slug` | Buscar empresa por slug (vitrine pública) | ❌ | — |
| `POST` | `/company/create` | Criar empresa (com novo usuário) | ❌ | — |
| `POST` | `/company/create-company-to-user` | Criar empresa para usuário existente | 🔑 JWT | — |
| `GET` | `/company/get-by-user-id` | Buscar empresa por userId | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/company/get-by-id/:companyId` | Buscar empresa por ID | 🔑 JWT | `INTERNAL_USERS` |
| `GET` | `/company/list` | Listar empresas do usuário (com filtros) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/company/get-all` | Listar todas as empresas | 🔑 JWT | `SYSTEM_MANAGERS` |
| `PATCH` | `/company/update/:companyId` | Atualizar empresa | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `DELETE` | `/company/deactivate/:companyId` | Desativar empresa | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `PATCH` | `/company/activate/:companyId` | Reativar empresa | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |

---

### 📁 Service-Group — Grupos de Serviços

> Gestão de grupos de serviços por empresa com definição de capacidade simultânea de atendimento, integridade relacional (`Restrict`) e soft delete seguro.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `POST` | `/service-group` | Criar novo grupo de serviços (valida posse da empresa) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/service-group` | Listar todos os grupos de serviços (com filtros) | 🔑 JWT | `INTERNAL_USERS` |
| `GET` | `/service-group/company/:companyId` | Listar grupos de serviços de uma empresa do usuário | 🔑 JWT | `INTERNAL_USERS` |
| `GET` | `/service-group/:id` | Buscar grupo de serviços por ID | 🔑 JWT | `INTERNAL_USERS` |
| `PATCH` | `/service-group/:id` | Atualizar grupo de serviços por ID (valida posse) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `PATCH` | `/service-group/company/:companyId/:id` | Atualizar grupo de serviços de uma empresa | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `DELETE` | `/service-group/:id` | Desativar grupo de serviços (soft delete protegido) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |

---

### 💈 Company-Service — Serviços da Empresa

> CRUD completo de serviços por empresa vinculados a um grupo de serviços, com taxa da plataforma e vitrine pública.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `POST` | `/company-service/create` | Criar serviço vinculado a um `serviceGroupId` | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/company-service/list` | Listar serviços da empresa do usuário logado | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/company-service/list/:slug` | Listar serviços por slug da empresa (vitrine pública) | ❌ | — |
| `PATCH` | `/company-service/update/:serviceId` | Atualizar serviço | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `DELETE` | `/company-service/deactivate/:serviceId` | Desativar serviço | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `PATCH` | `/company-service/activate/:serviceId` | Reativar serviço | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/company-service/all` | Listar todos os serviços | 🔑 JWT | `SYSTEM_MANAGERS` |

<details>
<summary>💰 <b>Taxa da Plataforma (automática)</b></summary>

| Preço do Serviço | Taxa |
|------------------|------|
| Até R$ 50,00 | 15% |
| R$ 50,01 — R$ 249,99 | 10% |
| R$ 250,00+ | 5% |

</details>

---

### 📅 Appointments — Agendamentos & Motor de Disponibilidade

> Criação com verificação de vagas pela capacidade do grupo de serviços, validação em tempo real de expediente e almoço, motor de cálculo matemático de slots livres (`AvailabilityService`), conclusão autenticada com proteção Anti-IDOR, cancelamento auditado e bloqueio de confirmação manual fraudulenta.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `GET` | `/appointments/available-slots` | Consulta pública de horários (slots) livres por serviço e data | ❌ | — |
| `POST` | `/appointments` | Criar agendamento (requer CPF cadastrado e expediente aberto) | 🔑 JWT | — |
| `GET` | `/appointments` | Listar todos os agendamentos | 🔑 JWT | `SUPER_ADMIN` |
| `GET` | `/appointments/company` | Listar agendamentos da empresa do usuário (blindado contra IDOR) | 🔑 JWT | `INTERNAL_USERS` |
| `GET` | `/appointments/user` | Listar agendamentos do cliente autenticado (blindado contra IDOR) | 🔑 JWT | — |
| `PATCH` | `/appointments/:id/complete` | Concluir agendamento confirmado (transição para `COMPLETED`) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `PATCH` | `/appointments/:id/status` | Atualizar status do agendamento (apenas transições válidas) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `DELETE` | `/appointments/:id/deactivate` | Cancelar/Desativar agendamento com log de auditoria | 🔑 JWT | — |

---

### ⏰ Working Hours & Schedule Exceptions — Expediente e Exceções

> Gestão completa da grade semanal de funcionamento da barbearia (dias da semana 0 a 6, início/fim de expediente, intervalo de almoço e fechamentos) e exceções pontuais/feriados na agenda.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `PUT` | `/working-hours` | Atualizar grade semanal de horários da empresa (em lote ou unitário) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/working-hours` | Listar grade semanal de funcionamento da empresa autenticada | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/working-hours/company/:companyId` | Consultar grade de funcionamento de uma empresa (vitrine pública) | ❌ | — |
| `POST` | `/working-hours/exceptions` | Cadastrar exceção pontual/feriado na agenda da empresa | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/working-hours/exceptions` | Listar exceções e feriados cadastrados pela empresa | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `DELETE` | `/working-hours/exceptions/:id` | Remover exceção da agenda (validação de posse Anti-IDOR) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |

---

### 💳 Financial Profile — Perfil Financeiro (Asaas)

> Gestão de subcontas financeiras no Asaas Sandbox para recebimento de pagamentos com split automatizado.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `POST` | `/financial-profile/create` | Criar perfil financeiro (subconta Asaas) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/financial-profile/list` | Listar perfis do usuário logado (com filtros) | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/financial-profile/user/:id` | Buscar perfil por ID pertencente ao usuário | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `GET` | `/financial-profile/get-by-id/:id` | Buscar perfil por ID (dados sensíveis sanitizados) | 🔑 JWT | `INTERNAL_USERS` |
| `GET` | `/financial-profile/get-all` | Listar todos os perfis (Administração) | 🔑 JWT | `SYSTEM_MANAGERS` |
| `DELETE` | `/financial-profile/deactivate/:id` | Desativar perfil financeiro | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |
| `PATCH` | `/financial-profile/activate/:id` | Reativar perfil financeiro | 🔑 JWT | `INTERNAL_NO_EMPLOYEE` |

---

### 💳 Transactions & Webhooks — Transações e Webhooks Asaas

> Cobrança Pix com split automático derivada 100% dos dados seguros do banco e atualização em tempo real via Webhook.

| Método | Rota | Descrição | Auth | Roles |
|--------|------|-----------|------|-------|
| `POST` | `/transactions/pix/:appointmentId` | Gerar ou recuperar cobrança Pix com split para a subconta Asaas | 🔑 JWT | — |
| `POST` | `/webhooks/asaas` | Receber notificações do Asaas (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`) | ❌ | Token Header |

---

## 🗄️ Banco de Dados

### Diagrama de Entidades

```mermaid
erDiagram
    User ||--o{ Company : "possui"
    User ||--o{ Appointment : "agenda"
    Company ||--o{ ServiceGroup : "organiza"
    Company ||--o{ Service : "oferece"
    Company ||--o{ Appointment : "recebe"
    Company ||--o{ WorkingHour : "define"
    Company ||--o{ ScheduleException : "configura"
    ServiceGroup ||--o{ Service : "agrupa (Restrict)"
    Service ||--o{ Appointment : "vincula (Restrict)"

    User {
        string id PK
        string name
        string email UK
        string password
        string phone
        string cpfCnpj
        string asaasCustomerId
        enum role "CLIENT | COMPANY_OWNER | EMPLOYEE | ADMIN | SUPER_ADMIN"
        string refreshToken
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime disabledAt
    }

    Company {
        string id PK
        string userId FK
        string businessName
        string slug UK
        string providerType
        string whatsapp
        int chairsCount
        string district
        string street
        string city
        string state
        string zipCode
        string number
        string logoPhoto
        string bannerPhoto
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime disabledAt
    }

    ServiceGroup {
        string id PK
        string name
        int capacity
        string companyId FK
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime disabledAt
    }

    Service {
        string id PK
        string companyId FK
        string serviceGroupId FK
        string name
        string description
        int durationMinutes
        decimal totalPrice
        int downPaymentPercent
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime disabledAt
    }

    Appointment {
        string id PK
        string companyId FK
        string serviceId FK
        string clientId FK
        datetime appointmentDate
        datetime appointmentEndDate
        enum status "PENDING_PAYMENT | CONFIRMED | COMPLETED | CANCELED"
        datetime expiresAt
        string pixTxId
        decimal servicePrice
        decimal downPaymentAmount
        decimal platformFeeAmount
        decimal amountPaidOnline
        decimal amountToPayInSalon
        decimal platformTaxCharged
        string disabledBy
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime disabledAt
    }

    WorkingHour {
        string id PK
        string companyId FK
        int dayOfWeek
        string startTime
        string endTime
        string lunchStartTime
        string lunchEndTime
        boolean isClosed
    }

    ScheduleException {
        string id PK
        string companyId FK
        datetime date
        string description
        boolean isClosed
        string startTime
        string endTime
        boolean isActive
        datetime disabledAt
    }
```

---

## 🏗️ Arquitetura do Projeto

```
src/
├── 📄 main.ts                          # Bootstrap + Swagger + Global Exception Filters
├── 📄 app.module.ts                    # Módulo raiz com registro de todos os submódulos
├── 📄 app.controller.ts               # Controller padrão
├── 📄 app.service.ts                   # Service padrão
│
├── 🧰 helpers/
│   ├── calculate-tax.helper.ts        # Cálculo de taxa da plataforma (faixas progressivas cumulativas)
│   ├── calculate-tax.helper.spec.ts   # Testes unitários do helper de taxas
│   ├── calculate-deposit.helper.ts    # Cálculo de sinal com trava de microtransações (R$ 15,00)
│   ├── calculate-deposit.helper.spec.ts # Testes unitários da trava de microtransações
│   ├── crypto.helper.ts               # Criptografia simétrica AES-256-GCM em repouso
│   ├── crypto.helper.spec.ts          # Testes unitários do helper de criptografia
│   ├── validate-image.helper.ts       # Validador de assinaturas binárias (Magic Bytes)
│   └── validate-image.helper.spec.ts  # Testes unitários do validador de imagens
│
├── 📋 common/
│   ├── constants/
│   │   ├── billing.constant.ts        # Constantes de faturamento, split Asaas e travas
│   │   └── role-groups.constant.ts    # Grupos de roles (SYSTEM_MANAGERS, INTERNAL_USERS, etc.)
│   └── filters/
│       └── prisma-client-exception.filter.ts # Filtro global de exceções Prisma
│
├── ✉️ modules/mail/
│   ├── mail.module.ts                 # Módulo de envio de e-mails Brevo
│   ├── mail.service.ts                # Serviço de e-mail transacional
│   ├── mail.service.spec.ts           # Testes unitários do MailService
│   └── templates/
│       └── email.templates.ts         # Repositório centralizado de templates HTML
│
├── 💳 asaas/
│   ├── asaas.module.ts
│   ├── asaas.service.ts
│   └── webhook-asaas/
│       ├── webhooks.controller.ts
│       ├── webhooks.module.ts
│       └── webhooks.service.ts
│
├── ☁️ cloudinary/
│   ├── cloudinary.module.ts
│   ├── cloudinary.provider.ts         # Provedor do SDK Cloudinary (CLOUDINARY_API_SECRET)
│   ├── cloudinary.service.ts
│   └── upload/
│       ├── upload.controller.ts       # Controlador blindado com RolesGuard e Anti-IDOR
│       ├── upload.controller.spec.ts  # Testes unitários de upload
│       └── upload.module.ts
│
├── 📁 service-group/
│   ├── service-group.module.ts
│   ├── service-group.controller.ts
│   ├── service-group.controller.spec.ts
│   ├── service-group.service.ts
│   ├── service-group.service.spec.ts
│   └── dto/
│       ├── create-service-group.dto.ts
│       ├── filters-service-group.dto.ts
│       └── update-service-group.dto.ts
│
├── 🗄️ prisma/
│   ├── prisma.module.ts                # Módulo global do Prisma
│   └── prisma.service.ts              # Conexão via Driver Adapter (pg)
│
└── 📦 modules/
    ├── 🔐 auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.controller.spec.ts
    │   ├── auth.service.ts
    │   ├── auth.service.spec.ts
    │   ├── dto/
    │   │   ├── forgot-password.dto.ts
    │   │   ├── reset-password.dto.ts
    │   │   └── user-login.dto.ts
    │   └── roles/
    │       ├── decorators/
    │       │   └── roles.decorator.ts
    │       └── guard/
    │           └── roles.guard.ts
    │
    ├── 👥 users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.controller.spec.ts
    │   ├── users.service.ts
    │   ├── users.service.spec.ts
    │   ├── constants/
    │   │   └── user-select.constant.ts # Seleção sanitizada de campos de usuário
    │   └── dto/
    │       ├── change-password.dto.ts
    │       ├── update-cpf-cnpj.dto.ts
    │       ├── user-create.dto.ts
    │       └── user-update.dto.ts
    │
    ├── 🏢 company/
    │   ├── company.module.ts
    │   ├── company.controller.ts
    │   ├── company.controller.spec.ts
    │   ├── company.service.ts
    │   ├── dto/
    │   │   ├── company-create.dto.ts
    │   │   ├── company-filter.dto.ts
    │   │   └── company-update.dto.ts
    │   └── helpers/
    │       └── create-slug.helper.ts
    │
    ├── 💈 company-service/
    │   ├── company-service.module.ts
    │   ├── company-service.controller.ts
    │   ├── company-service.controller.spec.ts
    │   ├── company-service.service.ts
    │   └── dto/
    │       ├── create-service.dto.ts
    │       ├── filter-service.dto.ts
    │       ├── list-service.dto.ts
    │       └── update-service.dto.ts
    │
    ├── ⏰ working-hours/
    │   ├── working-hours.module.ts
    │   ├── working-hours.controller.ts
    │   ├── working-hours.controller.spec.ts
    │   ├── working-hours.service.ts
    │   ├── working-hours.service.spec.ts
    │   └── dto/
    │       ├── create-schedule-exception.dto.ts
    │       ├── update-working-hours.dto.ts
    │       └── working-hour-item.dto.ts
    │
    ├── 📅 appointments/
    │   ├── appointments.module.ts
    │   ├── appointments.controller.ts
    │   ├── appointments.controller.spec.ts
    │   ├── appointments.service.ts
    │   ├── appointments.service.spec.ts
    │   ├── availability.service.ts
    │   ├── availability.service.spec.ts
    │   └── dto/
    │       ├── appointements-update.dto.ts
    │       ├── appointments-create.dto.ts
    │       ├── appointments-deactivate.dto.ts
    │       ├── appointments-filters.dto.ts
    │       └── available-slots-query.dto.ts
    │
    ├── 💳 financial-profile/
    │   ├── financial-profile.module.ts
    │   ├── financial-profile.controller.ts
    │   ├── financial-profile.controller.spec.ts
    │   ├── financial-profile.service.ts
    │   └── dto/
    │       ├── create-financial-profile.dto.ts
    │       └── filter-financial-profile.dto.ts
    │
    └── 💳 transactions/
        ├── transactions.module.ts
        ├── transactions.controller.ts
        ├── transactions.controller.spec.ts
        ├── transactions.service.ts
        └── transactions.service.spec.ts
```

---

## 🧪 Testes Unitários

O projeto possui **100% de cobertura de controladores e regras críticas de serviço**, totalizando **31 suítes de teste e 285 testes unitários automatizados**.

Para rodar todos os testes:

```bash
npm test
```

### O que é coberto pelos testes:
- **Autenticação & Tokens:** Login, geração e renovação de JWT/refresh token, validação estrita de status ativo (`isActive === true`) no login, no refresh e em cada requisição autenticada no `JwtStrategy`, e logout com invalidação de token.
- **Recuperação de Senha:** Proteção contra enumeração de e-mail, assinatura dinâmica stateless com `JWT_SECRET + user.password`, rejeição de tokens expirados/usados e redefinição de senha com invalidação de refresh token.
- **E-mails Brevo:** Disparo correto com dados populados e tratamento silencioso de erros de rede da API Brevo.
- **Usuários & Gestão de Contas:** Omissão de senhas e tokens na listagem (`USER_PUBLIC_SELECT`), alteração de senha autenticada, validação de unicidade de e-mail e CPF, rota para auto-desativação (`DELETE /users/me`), e rotas administrativas exclusivas para desativação e reativação de contas de terceiros (`DELETE /users/:userId` e `PATCH /users/:userId/activate` restritas a `SYSTEM_MANAGERS`).
- **Empresas & Promoção de Roles:** Criação com validação de unicidade de e-mail e slug, criação vinculada a usuário existente com promoção automática para `COMPANY_OWNER` e emissão/retorno imediato do novo par de tokens (`access_token`, `refresh_token`) refletindo os privilégios atualizados sem necessidade de novo login.
- **Storefront & Vitrine Pública Consolidada (`CompanyService.findBySlug`):** Endpoint público de alta performance (`GET /company/slug/:slug`) retornando dados cadastrais, grade completa de expediente (`workingHours`) e catálogo de serviços agrupados por capacidade (`serviceGroups` e `services`) em uma única query otimizada (`select`), com validação de status ativo e tratamento de erro 404.
- **Multi-tenancy & IDOR:** Bloqueio de consulta a agendamentos, grupos de serviços e uploads de empresas concorrentes, validação estrita de posse em criação, edição, exclusão e uploads, validação de UUID (`@IsUUID('4')`) e checagem de pertencimento de `serviceGroupId` à empresa do usuário logado na criação e edição de serviços (`createService` / `updateService`).
- **Uploads Seguros & Magic Bytes:** Proteção com `RolesGuard`, limite de 5MB por arquivo, validação de posse da empresa e inspeção binária real de magic bytes para JPEG, PNG e WEBP.
- **Proteção Anti-DoS de Reservas & Limpeza Automática:** Descarte imediato de reservas `PENDING_PAYMENT` expiradas na contagem de vagas, limite estrito de 3 reservas pendentes simultâneas por cliente e cron job a cada minuto (`@nestjs/schedule`) cancelando agendamentos/cobranças Asaas expiradas.
- **Sobreposição Canônica & Prevenção de Race Condition:** Bloqueio de agendamento em horários passados, checagem de sobreposição canônica de intervalos (`appointmentDate < newEndDate` e `appointmentEndDate > newStartDate`) agrupada pelo `serviceGroupId`, e transação atômica (`prisma.$transaction`) impedindo duplo agendamento simultâneo.
- **Webhooks Asaas, Idempotência & Conciliação Ativa:** Tabela dedicada `webhook_events` para de-duplicação e auditoria, conferência estrita de valores (`payment.value === transaction.totalValue`) com estorno automático de pagamentos divergentes, máquina de estados impedindo cancelamento de agendamentos confirmados por eventos atrasados (`PAYMENT_DELETED`), tratamento de chargeback/disputas (`PAYMENT_CHARGEBACK_*`), comparação de token em tempo constante (`crypto.timingSafeEqual`) e job cron a cada 30 minutos reconciliando transações pendentes via `GET /v3/payments/{id}`.
- **Perfis Financeiros & Criptografia em Repouso (AES-256-GCM):** Criptografia com tag de autenticação (`CryptoHelper`) de chaves de subcontas (`asaasApiKey`) em repouso no banco de dados com decriptação estrita sob demanda, projeção pública centralizada (`FINANCIAL_PROFILE_PUBLIC_SELECT`) e expurgo total de chaves privadas em todas as respostas HTTP e documentação Swagger.
- **Vitrine Pública & Histórico Congelado:** Exibição precisa de taxas em Reais na vitrine pública (`getServicesBySlug`), persistência congelada de `platformFeeAmount` e `downPaymentAmount` no banco de dados e reutilização exata na emissão de Pix no Asaas sem recálculos divergentes.
- **Integridade Financeira, Tipagem Decimal & Split Asaas:** Migração estrita de todos os campos monetários no banco de dados para `Decimal @db.Decimal(10, 2)` (`Service.totalPrice`, `Appointment.servicePrice`, `Appointment.downPaymentAmount`, `Appointment.platformFeeAmount`, `Transaction.totalValue`, `Transaction.netValue`, `Transaction.platformFee`, `Transaction.asaasFee`, `FinancialProfile.incomeValue`), evitando imprecisões de ponto flutuante binário IEEE 754; cálculo de taxa da plataforma por faixas cumulativas progressivas (15%, 10%, 5%) com **arredondamento para cima em múltiplos de R$ 0,25** e piso mínimo de R$ 2,00, configuração restrita de sinal do estabelecimento (25% ou 50%), seleção dinâmica de blocos pelo cliente (`[piso, 50, 75, 100]`), **trava de microtransações (Safety Gate de R$ 15,00)** com descarte de blocos inválidos/rejeição de sinais menores que R$ 15,00, taxa Asaas parametrizável (`ASAAS_PIX_FEE`) com validação no boot e atualização automática da taxa real liquidada via webhook (`Transaction.asaasFee`).
- **Expediente Semanal & Exceções de Agenda (`WorkingHoursModule`):** Configuração completa da grade semanal (`PUT /working-hours` e `GET /working-hours`) com validação estrita de horários (`startTime < endTime`, intervalo de almoço contido no expediente e formato `HH:mm`), consulta pública de horários da empresa (`GET /working-hours/company/:companyId`), e gestão de exceções/feriados (`POST`, `GET`, `DELETE /working-hours/exceptions`) protegidos contra IDOR.
- **Motor de Disponibilidade & Slot Engine (`AvailabilityService`):** Algoritmo canônico de cálculo de horários livres (`GET /appointments/available-slots`) cruzando expediente do dia (`WorkingHour`/`ScheduleException`), fatiamento em blocos com descarte automático de colisões com intervalo de almoço, filtragem por capacidade concorrente do grupo de serviços (`ServiceGroup.capacity`), descarte de horários passados no dia atual, e validação mandatória de expediente na criação de agendamentos (`AppointmentsService.createAppointment`).
- **Conclusão de Atendimento & Blindagem Anti-IDOR (`PATCH /appointments/:id/complete`):** Transição estrita e atômica para o status `COMPLETED`, restrita a donos de empresa autenticados (`COMPANY_OWNER`) e administradores do sistema (`ADMIN`/`SUPER_ADMIN`) validando a propriedade da barbearia (`appointment.company.userId === req.user.sub`), rejeitando transições em agendamentos `PENDING_PAYMENT`, `CANCELED` ou já `COMPLETED`.

---

## 🛠️ Stack Tecnológica

<div align="center">

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| ⚙️ **Runtime** | Node.js | >= 18 |
| 🏗️ **Framework** | NestJS | 11.x |
| 🔷 **Linguagem** | TypeScript | 5.x |
| 🗄️ **ORM** | Prisma | 7.8 |
| 🐘 **Banco de Dados** | PostgreSQL (Supabase) | 15.x |
| ✉️ **E-mails Transacionais** | Brevo SDK (@getbrevo/brevo) | 6.x |
| 💳 **Gateway de Pagamento** | Asaas Sandbox API v3 | — |
| 🔐 **Autenticação** | JWT (@nestjs/jwt) + Passport | — |
| 🔒 **Hash** | bcrypt | 6.x |
| ☁️ **Mídia** | Cloudinary | 2.x |
| 🧪 **Testes** | Jest + ts-jest | 30.x |
| 📖 **Documentação** | Swagger / OpenAPI | 11.x |
| ✅ **Validação** | class-validator | 0.15 |

</div>

---

## 📖 Documentação da API

Com o servidor rodando, acesse a documentação interativa do Swagger:

```
http://localhost:3000/api
```

---

## 📄 Licença

Este projeto está sob a licença **UNLICENSED** — uso privado.

---

<div align="center">

**Feito com ❤️ para o SinalizeGO**

<img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow?style=for-the-badge" />

</div>
