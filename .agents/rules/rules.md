---
trigger: always_on
---

# SinalizeGO - AI Agent Rules & Architecture Guidelines

You are the Antigravity Agent. Follow these strict patterns, architectural boundaries, and business rules across the NestJS codebase.

---

## 1. Core Workflow & Safety Protocols (MANDATORY)

*   **Database & Type Synchronization:** Run `npx prisma generate` immediately whenever `prisma/schema.prisma` is modified. Never write service logic or tests before regenerating types.
*   **PR Simulation & No Artifacts:**
    *   Never commit directly. Present changes exclusively as a formatted Pull Request in chat markdown (summary + diff).
    *   **DO NOT** use Artifacts for PR descriptions or diffs.
    *   Execute `git commit` ONLY after explicit user approval.
*   **Git Rules:**
    *   Commit messages must be strictly in **Portuguese** using Conventional Commits (`feat(modulo): ...`, `fix(seguranca): ...`).
    *   Never run `git push` without explicit user consent.
*   **Comprehensive Documentation Synchronization (MANDATORY & STRICT):**
    *   Whenever any code, endpoint, DTO, entity, helper, test suite, or business rule is created, updated, or modified, you **MUST** simultaneously review and update all corresponding sections of `README.md` within the exact same PR:
        1. **Tabelas de Endpoints por Módulo:** Incluir novos endpoints, atualizar parâmetros, roles e autenticação.
        2. **Árvore Estrutural de Arquivos (`src/`):** Adicionar novos módulos, arquivos, DTOs e helpers criados.
        3. **Diagrama do Banco de Dados (Mermaid):** Refletir novos campos, tipos (`Decimal`) ou relações.
        4. **Métricas de Testes Unitários:** Atualizar a contagem exata de suítes e testes unitários automatizados em todas as seções (Destaques e Seção de Testes).
        5. **Descrições de Regras e Cobertura:** Documentar o comportamento e as garantias de segurança recém-implementadas.
*   **Vulnerability Disclosure:** If a security flaw is detected: analyze it, plan the fix, report in chat, and wait for approval before patching.
*   **Zero Real External Calls:** Mock all third-party APIs (Asaas, Cloudinary, SMTP) in `.spec.ts` unit/integration tests.

---

## 2. Architecture & Code Standards

*   **Stack:** NestJS 11 (strict DI/Modules), Prisma ORM 7, TypeScript strict (no `any`).
*   **Structure:** Modules in `src/modules/` or domain roots (`src/asaas/`, `src/cloudinary/`, `src/service-group/`). Helpers in `src/helpers/`. Shared constants/filters in `src/common/`.
*   **Soft Deletes:** Respect `isActive` / `disabledAt` across entities; avoid hard deletes on auditable tables.
*   **Prisma Efficiency:** Always use explicit `select` / `include` to prevent N+1 queries and overfetching.
*   **DTOs & Errors:** Every endpoint must have a validated DTO (`class-validator`). Always throw semantic NestJS exceptions (`BadRequestException`, `ForbiddenException`, `ConflictException`).
*   **Helper Registry:** When creating a new reusable helper, place it in `src/helpers/` and register it under Section 3 in this document.

---

## 3. Registered Helpers & Core Components (Reuse STRICTLY)

*   **`CalculateTax` (`src/helpers/calculate-tax.helper.ts`):** Calculates platform fees over deposit amount with cumulative brackets, R$ 2.00 floor (`MIN_PLATFORM_TAX`), and ceiling rounding to multiples of **R$ 0.25**.
*   **`CalculateDeposit` (`src/helpers/calculate-deposit.helper.ts`):** Handles deposit blocks (`[floor, 50, 75, 100]`) and the R$ 15.00 Micro-Transaction Safety Gate.
*   **`ValidateImage` (`src/helpers/validate-image.helper.ts`):** Validates real binary magic bytes for uploads (JPEG, PNG, WEBP).
*   **`CryptoHelper` (`src/helpers/crypto.helper.ts`):** Symmetric encryption and decryption at rest (AES-256-GCM) with authentication tags for sensitive credentials (`asaasApiKey`).
*   **`PrismaClientExceptionFilter` (`src/common/filters/prisma-client-exception.filter.ts`):** Global filter mapping `P2002` (409) and `P2025` (404). Do not write manual try/catch for standard Prisma errors.
*   **`RolesGuard` (`src/modules/auth/roles/guard/roles.guard.ts`):** Enforces RBAC with `@Roles()`.

---

## 4. Core Business, Billing & Financial Rules (CRITICAL)

*   **Deposit Configuration:** Barbers define service `downPaymentPercent` exclusively as **25%** or **50%** (`@IsIn([25, 50])`).
*   **Dynamic Customer Blocks:** Checkout offers progressive options: `[configured_floor, ..., 75%, 100%]`.
*   **Micro-Transaction Gate (R$ 15.00 Threshold):**
    *   Minimum fractional deposit amount is **R$ 15.00**.
    *   If total price `< R$ 15.00`, force **100% upfront**.
    *   If total price `>= R$ 15.00`, dynamically discard percentage blocks resulting in `< R$ 15.00` (exposing only options `>= R$ 15.00` + `100%`).
*   **Fee Rules & Rounding:**
    *   Platform fee minimum floor is **R$ 2.00** (`MIN_PLATFORM_TAX`).
    *   Fee must round UP (`Math.ceil(fee * 4) / 4`) to the nearest **R$ 0.25** increment.
*   **Immutable Historical Pricing:** Freeze `servicePrice`, `downPaymentAmount`, and `platformFeeAmount` in `Appointment` at creation. Never recalculate fees for existing bookings from live service tables.
*   **Onboarding Gate:** Block bookings and service creation if the company's Asaas subaccount lacks a valid `walletId` or approved status.
*   **Cancellation Policy (CDC Art. 51 / CC Arts. 417 a 420):**
    *   `> 24h` before appointment: Trigger full Asaas refund (`refundPayment`).
    *   `<= 24h`: Cancel appointment to free calendar; retain guaranteed minimum deposit for the barber as vacancy compensation, and automatically trigger partial refund via Asaas for any excess amount paid upfront.

---

## 5. Security, Anti-IDOR & Gateway Protection (ZERO TRUST)

*   **Zero Trust on Financial Payloads:** Never accept monetary values, split amounts, or fee percentages from the client. All financial values must be derived server-side.
*   **Anti-IDOR & Multi-Tenancy:**
    *   Never trust IDs (`companyId`, `userId`) from DTO/params without checking ownership against `req.user.sub`.
    *   Scope all mutations and queries by the authenticated user's tenant.
*   **Credential Leak Prevention:**
    *   Never return `password`, `refreshToken`, `asaasApiKey`, or sensitive CPF/CNPJ in HTTP responses or Swagger examples. Use explicit `select`.
*   **Guard Integrity & Status Changes:**
    *   Every protected route must apply `JwtAuthGuard`. If `@Roles()` is declared, include `RolesGuard` in `@UseGuards(JwtAuthGuard, RolesGuard)`.
    *   Status transition to `CONFIRMED` is **strictly restricted to authenticated Asaas webhooks**. Manual PATCH endpoints must never set `CONFIRMED`.
*   **Pix Anti-DoS (15-Minute Hold):**
    *   All Pix charges expire in **15 minutes** (`expiresAt`).
    *   Slot availability checks dynamically exclude expired `PENDING_PAYMENT` records (`OR: [{ status: { not: 'PENDING_PAYMENT' } }, { expiresAt: { gt: now } }]`).
    *   Limit clients to **3 concurrent active `PENDING_PAYMENT`** bookings.
    *   A Cron Job (`@nestjs/schedule`) runs every minute to mark expired appointments as `CANCELED` and delete the charge on Asaas.

---

## 6. External Documentation

*   **Asaas Payment Gateway Reference:**
    *   LLM index: `https://docs.asaas.com/llms.txt`
    *   Append `.md` to any documentation URL to read raw markdown (e.g., `https://docs.asaas.com/reference/criar-nova-cobranca.md`).\n> **Prisma Rule**: NEVER use `select` inside an `include` block (Prisma throws a runtime/type validation error). Always use nested `select` blocks exclusively when projecting relation fields (e.g. `select: { id: true, relation: { select: { field: true } } }`).

> **Prisma Rule**: NEVER use `select` inside an `include` block (Prisma throws a runtime/type validation error). Always use nested `select` blocks exclusively when projecting relation fields (e.g. `select: { id: true, relation: { select: { field: true } } }`).
