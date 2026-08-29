# SinalizeGO - AI Agent Rules & Codebase Guidelines

Welcome, Antigravity Agent. This document outlines the core architectural patterns, folder structures, and existing functionalities you **must** adhere to and utilize when working on this NestJS API.

### Database Schema & TypeScript Synchronization (MANDATORY)

*   **Prisma Client Generation on Schema Changes:**
    *   Whenever `prisma/schema.prisma` is modified, you **MUST** immediately run `npx prisma generate` so that TypeScript and the Prisma Client types reflect the updated models, enums, and relations.
    *   Never proceed to writing service logic or running tests after a schema edit without regenerating the Prisma client first.

## 1. Architectural Patterns & Strengths to Maintain

*   **Framework:** NestJS (v11). Always follow NestJS conventions: use Dependency Injection, Modules, Controllers, and Services.
*   **Database ORM:** Prisma (v7). Use Prisma for all database interactions. Ensure schema changes are reflected correctly in `prisma/schema.prisma` and migrations are managed.
*   **Modularity:** The application is highly modular. Every distinct domain/feature has its own module under `src/modules/` or in the root `src/` (like `asaas`, `cloudinary`, `service-group`). Do not create monolithic services.
*   **Validation:** Use `class-validator` and `class-transformer` in DTOs (Data Transfer Objects) for all incoming requests. The `ValidationPipe` is set up globally.
*   **Security & RBAC:** Role-Based Access Control is enforced. Roles include `CLIENT`, `COMPANY_OWNER`, `EMPLOYEE`, `ADMIN`, `SUPER_ADMIN`.
*   **Error Handling:** A global Prisma exception filter handles database errors gracefully (e.g., conflicts, not found).

## 2. Folder Structure Guidelines

*   `src/modules/`: Contains business logic modules (Auth, Users, Company, Appointments, etc.). When creating a new domain, put it here.
*   `src/common/`: Shared resources like Constants (`src/common/constants/`) and Filters (`src/common/filters/`).
*   `src/helpers/`: Utility functions and isolated business logic helpers.
*   `prisma/`: Contains `schema.prisma` (Database models) and `migrations`.

## 3. Existing Functions & Helpers to Re-use

You must reuse existing code instead of rewriting functionality. Pay special attention to these existing components:

*   **`CalculateTax` (Helper - `src/helpers/calculate-tax.helper.ts`)**:
    *   **Purpose**: Use this for any logic involving platform fees and tax calculations based on service prices (cumulative progressive brackets: 10% up to R$ 250.00 and 5% above with R$ 0.25 ceiling rounding and R$ 2.00 minimum floor).
    *   **Methods**: `calculatePlatformTaxPercentage(totalPrice)` and `calculatePlatformTax(totalPrice)`.

*   **`CalculateDeposit` (Helper - `src/helpers/calculate-deposit.helper.ts`)**:
    *   **Purpose**: Use this for deposit calculation applying the automated 50% default (with R$ 15.00 Safety Gate or 100% if < R$ 15.00) and 30% high-ticket option for services >= R$ 400.00.
    *   **Methods**: `calculateDeposit(totalPrice, serviceDepositPercent?)`, `calculateDepositDetails(totalPrice, serviceDepositPercent?)` and `getAvailableBlocks(totalPrice, serviceDepositPercent?)`.

*   **`ValidateImage` (Helper - `src/helpers/validate-image.helper.ts`)**:
    *   **Purpose**: Validates real binary file signatures (Magic Bytes) for image uploads (JPEG, PNG, WEBP) to prevent malicious or forged MIME uploads.
    *   **Methods**: `isValidImageMagicBytes(buffer: Buffer): boolean`.

*   **`CryptoHelper` (Helper - `src/helpers/crypto.helper.ts`)**:
    *   **Purpose**: Symmetric encryption and decryption at rest (AES-256-GCM) with authentication tags for sensitive credentials (e.g. `asaasApiKey`).
    *   **Methods**: `CryptoHelper.encrypt(plaintext: string): string` and `CryptoHelper.decrypt(ciphertext: string): string`.

*   **`AllExceptionsFilter` (Filter - `src/common/filters/all-exceptions.filter.ts`)**:
    *   **Purpose**: Global unified exception filter registered in `main.ts`. Standardizes all error payloads (HttpException, Prisma errors, Unhandled errors) into a structured JSON payload with `statusCode`, `message`, `error`, `timestamp`, and `path`.

*   **`PrismaClientExceptionFilter` (Filter - `src/common/filters/prisma-client-exception.filter.ts`)**:
    *   **Purpose**: Maps Prisma errors (`P2002` Conflict, `P2025` Not Found) to proper HTTP responses. Do not write manual try-catch blocks in controllers just to return 404 or 409 for these Prisma errors. Rely on the global filter.

*   **`RolesGuard` (Guard - `src/modules/auth/roles/guard/roles.guard.ts`)**:
    *   **Purpose**: Use this guard alongside the `@Roles()` decorator to protect routes based on user roles.
    *   **Usage**: Check `src/common/constants/role-groups.constant.ts` (if it exists) or use individual roles from the `Role` enum in Prisma.

*   **Authentication**: The app uses JWT via Passport. Routes are typically protected by a JwtAuthGuard (implied, verify per module). User data is extracted from the request (`req.user`).

## 4. Coding Standards

*   **Language:** TypeScript strictly. Avoid `any`. Use proper types or interfaces.
*   **Formatting:** Prettier and ESLint are configured. Ensure all code generated respects these rules.
*   **Testing:** The project boasts high test coverage. When adding features, write or update corresponding unit tests (`.spec.ts`) using Jest.
*   **Soft Deletes:** Notice in the Prisma schema that entities like `User`, `Company`, `Appointment` have `isActive` and `disabledAt` fields. Implement soft deletes rather than hard `DELETE` operations unless strictly necessary.
*   **New Reusable Functions Registry (STRICT):** Whenever you (or the agent) create a new reusable function or helper, it **must** be placed in the appropriate directory (e.g., `src/helpers/` or `src/common/`). Immediately after creation, you **must document it in this rules file** under section `3. Existing Functions & Helpers to Re-use`, following the exact same pattern as `CalculateTax`.
*   **Prisma Performance & N+1 Prevention:** When fetching data via Prisma, never blindly include heavy relations (`include: { all: true }`). Always explicitly select (`select`) or include (`include`) only the fields strictly required for the specific task to prevent performance bottlenecks.
*   **DTO and Validation Rigidity:** Every new endpoint must have a dedicated DTO. Do not bypass `class-validator` decorators. If an ID is passed, ensure it validates against the correct type (e.g., `@IsUUID()` or `@IsInt()`).
*   **Idiomatic NestJS Exception Handling:** Never throw generic `Error` objects. Always throw semantic NestJS Built-in HTTP Exceptions (e.g., `BadRequestException`, `UnauthorizedException`, `InternalServerErrorException`) when business rules are violated outside of Prisma's automatic scope.

---

> ⚠️ **Antigravity Agent Warning:** If you create a helper/utility and forget to update this rules document, you are violating the SinalizeGO ecosystem maintenance protocol.

## 5. Git & Version Control Guidelines

*   **Commits:** You are allowed to commit changes (`git commit`) when appropriate. Commit messages **must be written strictly in Portuguese**, following Conventional Commits (ex: `feat(agendamentos): adicionar validacao de sinal`, `fix(seguranca): corrigir vazamento de idor`).
*   **Push / Remote Operations:** Always ask the user for confirmation **before** executing any `git push`. Never push to remote branches without explicit user authorization.

## 6. Development Workflow & Safety Protocols

*   **Pull Request (PR) Simulation:** Whenever you modify or write new code, do not commit it immediately. You **must** present the changes in the chat formatted as a Pull Request (including description and code diff/blocks). You are only allowed to execute a `git commit` **after** the user explicitly reviews and accepts the PR.
*   **PR Simulation Output Format:**
    *   Always present Pull Request summaries and diffs directly in the chat as standard Markdown text.
*   **Comprehensive Documentation Synchronization (MANDATORY & STRICT):** Whenever any code, endpoint, DTO, entity, helper, test suite, or business rule is created, updated, or modified, you **MUST** simultaneously review and update all corresponding sections of `README.md` within the exact same PR:
    1. **Tabelas de Endpoints por Módulo:** Incluir novos endpoints, atualizar parâmetros, roles e autenticação.
    2. **Árvore Estrutural de Arquivos (`src/`):** Adicionar novos módulos, arquivos, DTOs e helpers criados.
    3. **Diagrama do Banco de Dados (Mermaid):** Refletir novos campos, tipos (`Decimal`) ou relações.
    4. **Métricas de Testes Unitários:** Atualizar a contagem exata de suítes e testes unitários automatizados em todas as seções (Destaques e Seção de Testes).
    5. **Descrições de Regras e Cobertura:** Documentar o comportamento e as garantias de segurança recém-implementadas.
*   **Refactoring & Divergence Check:** If you have doubts, want to diverge from the original request, or notice an opportunity for refactoring while executing a task, stop immediately. Ask the user in a simple, direct manner what you intend to do, and **only** proceed if the user grants explicit approval.
*   **Security Vulnerability Protocol:** If you encounter a potential security flaw while reading or exploring the codebase, you must:
    1. Analyze and understand why it exists.
    2. Determine how it could be exploited.
    3. Plan a clean architectural fix.
    4. Report this entire analysis directly in the chat.
    *Do not patch, fix, or modify the security flaw until the user explicitly commands you to do so.*
*   **Mocking Third-Party Services in Tests:** When writing unit or integration tests (`.spec.ts`), you must completely mock external APIs (like Asaas, Cloudinary, or SMTP). Never allow actual network calls during test execution.

## 7. Core Business & Billing Rules (CRITICAL)

*   **Establishment Down Payment Configuration:**
    *   When creating or editing services, the professional/barber defines `downPaymentPercent` / `depositPercentage` as **50%** (default) or **30%** (optional for high-ticket services `>= R$ 400.00`). If `price < R$ 400.00`, it is strictly normalized to 50%.

*   **Automated Server-Side Deposit Calculation:**
    *   The deposit fraction is calculated 100% server-side based on the service rules (client manual selection removed).

*   **Micro-Transaction Safety Gate (R$ 15.00 Threshold):**
    *   The absolute minimum amount allowed for fractional/deposit payments is **R$ 15.00**.
    *   If the total service price is below R$ 15.00, the system **must strictly enforce 100% upfront payment** at booking.
    *   For services priced at R$ 15.00 or higher, the deposit is `Math.max(calculatedDeposit, 15.00)`.

*   **Platform Margin & Floor Tax Guarantee:**
    *   The platform minimum fee (**R$ 2.00**) is immutable and mandatory across all transactions (`MIN_PLATFORM_TAX`), guaranteeing a positive net margin regardless of the service price.

*   **Platform Fee Rounding (Multiples of R$ 0.25 Ceiling):**
    *   Platform fee calculations must never output arbitrary or broken cents (e.g., R$ 2.37 or R$ 3.42).
    *   The calculated platform tax must always round UP (`Math.ceil`) to the nearest multiple of **R$ 0.25** (e.g., 2.00, 2.25, 2.50, 2.75, 3.00, etc.), maintaining the minimum floor of R$ 2.00.

*   **Financial Reporting Splits:** Every booking must explicitly calculate and persist:
    1. `amountPaidOnline`: Processed immediately via gateway.
    2. `amountToPayInSalon`: To be paid locally to the barber.
    3. `platformTaxCharged`: Based on the cumulative bracket formula from `CalculateTaxHelper`.

## 8. Advanced Business Logic & Gateway Safeguards

*   **Pix Expiration, Anti-DoS & Booking Hold Limits:** To strictly prevent schedule collisions and denial of service:
    *   Every Pix charge created via Asaas **must** be generated with an explicit expiration timeframe of **15 minutes** (`expiresAt`).
    *   Slot availability checks dynamically exclude expired `PENDING_PAYMENT` appointments (`OR: [{ status: { not: 'PENDING_PAYMENT' } }, { expiresAt: { gt: now } }]`).
    *   A client is limited to a maximum of **2 concurrent active appointments** (`MAX_ACTIVE_APPOINTMENTS_PER_CLIENT = 2`) simultaneously.
    *   Accounts with **3 or more cancellations in the same week (7 days)** are blocked preventively from creating new appointments (`MAX_WEEKLY_CANCELLATIONS_LIMIT = 3`).
    *   A scheduled task (Cron Job `@nestjs/schedule`) executes every minute to cancel expired pending bookings and release gateway charges.
*   **Immutable Historical Pricing:** Once an `Appointment` is created, all financial fields (`totalAmount`, `amountPaidOnline`, `amountToPayInSalon`, `platformTaxCharged`) must be permanently frozen in that record. Never calculate real-time values based on the `Service` or `Company` tables for existing appointments, ensuring price changes do not retroactively affect past bookings.
*   **Onboarding Strict Requirements:** A company/barber is strictly prohibited from activating booking capabilities or creating services if their Asaas subaccount integration is incomplete. The system must validate that the `walletId` exists and the account status is fully active/approved before opening the schedule.
*   **Cancellation & Escrow Hold Rules (CDC Art. 51 / CC Arts. 417 a 420):** Funds received via split must remain locked in the ecosystem ledger until the service is successfully rendered or the cancellation window closes. 
    *   If a client requests a cancellation *before* the 24-hour mark prior to the appointment, the system triggers the Asaas refund API for a full 100% refund.
    *   If the cancellation request occurs *within* the 24-hour mark, the cancellation is permitted to free the calendar; the guaranteed minimum deposit (`guaranteedDepositAmount`) is retained for the barber as vacancy compensation, and any excess amount paid upfront by the client is automatically refunded partially via Asaas Pix.
*   **Weekly Free Payout Floor & Balance Accumulation Rule:**
    *   The weekly automatic free payout (`@Cron('0 6 * * 1')`) executes strictly for companies with `availableBalance >= R$ 100.00` (`MIN_FREE_WEEKLY_PAYOUT`).
    *   If `availableBalance < R$ 100.00`, the balance is never lost or canceled; it remains accumulating in the company account until reaching the R$ 100.00 threshold for the next free payout cycle.
    *   Companies wishing to withdraw balances `< R$ 100.00` immediately can use the On-Demand Instant Withdrawal endpoint (`POST /company/withdraw`) paying the standard Asaas transfer fee (`ASAAS_TRANSFER_FEE = R$ 5.00`).


## 9. Cybersecurity & Data Integrity (MANDATORY)

*   **Anti-IDOR & Multi-tenancy Enforcement (Zero Trust):**
    *   Never trust `companyId`, `userId` or resource IDs passed via DTO, params, or request body for authorization.
    *   Always validate ownership by checking `req.user.sub` against the database before querying, updating, or deleting resources.
    *   Never create endpoints that delete or mutate records with Prisma using solely a raw `:id` parameter without scoping by tenant/owner (`userId` / `companyId`).

*   **Zero Trust on Financial Inputs:**
    *   Endpoints related to payments, deposits, splits, or bookings must **NEVER** accept monetary values, fee percentages, or wallet IDs from client payloads.
    *   All financial values must be derived strictly on the server from validated database entities (`Service`, `Appointment`, constants) and frozen in the transaction record.

*   **Credential & Secret Leak Prevention:**
    *   Never query `User` models using wildcard selections (`findMany()` / `findUnique()` without explicit `select`). Always exclude sensitive columns (`password`, `refreshToken`, `asaasApiKey`, `cpfCnpj`).
    *   Never return raw sub-account API keys, internal secrets, or webhook tokens in any HTTP response or Swagger documentation example.

*   **Authorization Guard Integrity:**
    *   Every protected route must apply `JwtAuthGuard`.
    *   When `@Roles()` is declared, ensure `RolesGuard` is explicitly included in `@UseGuards(JwtAuthGuard, RolesGuard)` at the method or controller level.
    *   Critical business state transitions (e.g., setting an appointment to `CONFIRMED`) must **ONLY** be executable via authenticated gateway webhooks, never via manual user PATCH endpoints.

### 10. External Integrations & Reference Documentation

*   **Asaas Payment Gateway Reference:**
    *   Documentation index for LLM agents: `https://docs.asaas.com/llms.txt`
    *   To read any Asaas reference page in markdown format, append `.md` to the documentation URL (e.g., `https://docs.asaas.com/reference/criar-nova-cobranca.md`).
    *   Always refer to official Asaas v3 schemas when constructing payloads for customer creation, Pix generation, and split processing.\n> **Prisma Rule**: NEVER use `select` inside an `include` block (Prisma throws a runtime/type validation error). Always use nested `select` blocks exclusively when projecting relation fields (e.g. `select: { id: true, relation: { select: { field: true } } }`).

> **Prisma Rule**: NEVER use `select` inside an `include` block (Prisma throws a runtime/type validation error). Always use nested `select` blocks exclusively when projecting relation fields (e.g. `select: { id: true, relation: { select: { field: true } } }`).
