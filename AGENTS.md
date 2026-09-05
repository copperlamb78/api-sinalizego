# SinalizeGO — AI Agent Rules & Codebase Guidelines

> Prescriptive rules for any AI agent working on this repository. This file is
> self-contained on purpose: agents that run in the cloud (Jules) only see what
> is committed to git, so it must never depend on unversioned files.
>
> Stack: NestJS 11 · Prisma ORM 7 · PostgreSQL · Asaas (Pix, split, subaccounts)
> · Brevo (transactional e-mail) · Cloudinary (images).

---

## 1. Escalation protocol — ask first, never assume

This gate outranks speed and completeness.

- **Doubt gate.** Any uncertainty about a business rule, a monetary value, which
  rule wins, or the scope of the request: **stop and ask.** Do not infer, do not
  pick a "reasonable default", do not proceed on an assumption you plan to
  disclose afterwards. Uncertainty about *what to build or what the rule is*
  always escalates; mechanical execution of an already-decided instruction does
  not.
- **Possible-error gate.** When you spot something that looks wrong — a bug, a
  security flaw, code contradicting a documented rule, dead code — report it
  prominently, say where it is and why it matters, and offer **numbered options
  with trade-offs**. Never apply the fix without explicit approval. This applies
  to code you wrote yourself earlier in the same session.
- **Divergence gate.** When the request replaces, contradicts or undoes code
  that already exists **and is technically correct**, do not comply silently and
  do not refuse. Show what is there — where it lives, what it does today, why it
  is that way — state concretely what the request would change, and ask whether
  that is intentional. Triggers: reimplementing what a registered helper already
  does, changing a business-rule constant without framing it as a rule change,
  replacing a pattern used consistently elsewhere, removing a deliberate guard,
  lock, validation or ownership check. It does **not** trigger on genuinely new
  behavior, on a user who says they already know, or on fixing something
  documented as broken. Ask **once**, then carry out the decision without
  re-litigating — the purpose is to catch a change made out of confusion, not to
  gatekeep.
- **Never bundle an unrelated fix into the task at hand.** One concern per
  change.
- **Present work as a Pull Request.** Never commit to `main` directly. Never
  `git push` without consent. Commit messages in **Portuguese**, Conventional
  Commits: `feat(modulo): …`, `fix(seguranca): …`.
- **Um commit por arquivo.** Para facilitar o code review, realize **um commit individual por arquivo** (`git add <arquivo> && git commit -m '...'`), com mensagem semântica em Conventional Commits em português descrevendo a alteração daquele arquivo específico.

## 2. Workflow & safety

- Run `npx prisma generate` immediately after touching `prisma/schema.prisma`.
  Never write service logic or tests before regenerating types.
- **Never assume the database matches `prisma/schema.prisma`.** This project was
  provisioned with `db push` and `migrate deploy` at different times. Before any
  work that depends on a column or a type existing, verify the real state. If a
  task requires generating a migration, **stop and escalate** — a migration
  authored against a divergent database can emit an unintended `DROP`.
- Mock every third-party API (Asaas, Cloudinary, Brevo) in `*.spec.ts`. Zero
  real external calls in tests.
- Any PR that changes code, endpoints, DTOs, entities, helpers, tests or
  business rules MUST update `README.md` in the same PR: endpoint tables, the
  `src/` file tree, the Mermaid database diagram, the exact test counts, and the
  descriptions of rules and guarantees.

## 3. Architecture & structure

- NestJS 11 with strict DI and modules. TypeScript strict — **no `any`**.
- Modules in `src/modules/`, or domain roots for cross-cutting integrations:
  `src/asaas/`, `src/cloudinary/`, `src/service-group/`.
- Reusable logic in `src/helpers/`. Shared constants and filters in
  `src/common/`. Prisma access through `src/prisma/prisma.service.ts`.
- Respect soft deletes (`isActive` / `disabledAt`, plus `disabledBy` on
  `Appointment`). No hard deletes on auditable tables.
- `ServiceGroup → Service` and `Service → Appointment` use `onDelete: Restrict`
  deliberately: financial history must not cascade away.

## 4. Route anatomy

Decorator order, as used across the codebase:

```ts
@ApiBearerAuth()                        // authenticated routes only
@UseGuards(JwtAuthGuard, RolesGuard)    // RolesGuard whenever @Roles is present
@Roles(...INTERNAL_NO_EMPLOYEE)         // always a group, never a bare role
@Post('create')
@ApiBody({ type: CreateServiceDto })
@ApiResponse({ status: 201, description: '...' })
async createService(@Body() dto: CreateServiceDto, @Req() req: Request) {
  const userId = req.user?.['sub'];
  return this.service.createService(dto, userId);
}
```

- `@Roles()` without `RolesGuard` in `@UseGuards` protects nothing — the
  decorator becomes dead metadata.
- Role groups live in `src/common/constants/role-groups.constant.ts`:
  `SYSTEM_MANAGERS`, `INTERNAL_USERS`, `INTERNAL_NO_EMPLOYEE`. Never write
  `Role.ADMIN` inline in a controller.
- `userId` comes from `req.user?.['sub']` — never from the body or a query
  param — and travels as the **first argument** to the service method.
- `JwtStrategy.validate` already returns `{ sub, email, role }`. Do not re-query
  the user just to read `role`.
- Every endpoint with a body or query has a DTO with `class-validator`. The
  global `ValidationPipe` uses `whitelist: true`, so an undeclared field is
  silently dropped — if a field must be rejected, declare and validate it.
- A date query parameter meaning *a day* needs `@IsDateString()` **and**
  `@Matches(/^\d{4}-\d{2}-\d{2}$/)`. Without the second, an offset-bearing
  string silently lands on the wrong day.

## 5. Errors

Throw semantic Nest exceptions. Never signal failure with a return value —
`return false` from a method that performs external I/O gets treated by callers
as if it threw, and the failure disappears.

| Situation | Exception |
|---|---|
| invalid input, business rule violated | `BadRequestException` (400) |
| no permission over the resource | `ForbiddenException` (403) |
| resource does not exist | `NotFoundException` (404) |
| state or uniqueness conflict | `ConflictException` (409) |
| expired resource | `GoneException` (410) |
| anti-abuse limit reached | `HttpException(msg, TOO_MANY_REQUESTS)` (429) |

Standard Prisma errors (`P2002`, `P2025`) are already mapped by
`PrismaClientExceptionFilter`. Do not write manual try/catch for them.
Never forward a raw third-party gateway message to the end user.

## 6. Prisma & database

**`select` and `include`.** Prisma rejects `select` and `include` as **sibling
keys at the same level** of the same query object. Nesting `select` **inside** a
relation listed in `include` is valid and is the recommended way to project
relation fields:

```ts
// ✅ valid — this pattern runs on the payment-confirmation path
include: {
  client:  { select: { id: true, name: true, email: true } },
  company: { select: { id: true, businessName: true } },
}
```

Prefer a top-level `select` with nested `select` for full control of the
payload. Never fetch whole rows by default.

**Money is `Decimal`, never float.** Convert explicitly on read
(`Number(appointment.downPaymentAmount)`). Fee and deposit maths use integer
cents arithmetic — see §9. When comparing an amount returned by the gateway, use
an explicit tolerance (`paid < expected - 0.01`), never strict equality.

**Aggregate in the database.** Never `findMany` a table into memory to `reduce`
a sum. Use `prisma.aggregate({ _sum })`.

**Pagination.** Listing endpoints need `page`/`limit` in the filter DTO. Every
`take` needs an `orderBy` — without it the order is undefined and a backlog can
starve rows indefinitely. `findMany` without `take` inside a cron is a defect.

**Indexes.** Postgres does not create an index for a foreign key automatically,
and Prisma only creates what is declared. When adding a recurring filter, check
whether the column has `@@index`.

**Concurrency.** The established pattern is a pessimistic lock inside
`prisma.$transaction` (`SELECT id FROM "User" WHERE id = ? FOR UPDATE`).
External calls never go inside a transaction — reserve state in the transaction,
call the network outside it, and roll the reservation back on failure.

## 7. Timezone

`Company.timezone` is the authority for wall-clock conversion.

- **Never** use the local `Date` constructor or `getHours()` / `getDate()` /
  `getDay()` / `setHours()` for business logic — they resolve in the *server's*
  timezone. Brazil spans four offsets.
- Every conversion between "09:00 at the shop" and an absolute instant goes
  through `company.timezone`, via `date-fns-tz` or `Intl`. If a function did not
  receive the timezone, it cannot decide on its own — pass it or escalate.
- Working-hour strings (`WorkingHour.startTime = "09:00"`) are wall-clock and
  are modelled correctly. Do not change the storage; the conversion is what
  matters.
- To derive a day of week from a `YYYY-MM-DD` string, use noon UTC — it is
  immune to ±12h offsets. `availability.service.ts` has the reference
  implementation.
- Every `@Cron` needs an explicit `timeZone` option.
- Run tests with `TZ=UTC`, and build dates in tests with explicit UTC
  (`new Date('2029-08-28T10:00:00.000Z')`, never without the `Z`).

## 8. Security & multi-tenancy

**A role is not a tenant.** `@Roles(...INTERNAL_USERS)` answers "what kind of
account is this?", not "may this account see this record?". Ownership is checked
in the **service**, always, even on a route that already has `@Roles`.

```ts
// ❌ the ID came from a param and nobody asked whose it is
findUnique({ where: { id: companyId } })

// ✅ the tenant is part of the where
findFirst({ where: { id: companyId, userId }, select: { /* explicit */ } })
```

- `findUnique({ where: { id } })` on a client-supplied ID is forbidden without
  tenant scope. If `SYSTEM_MANAGERS` needs unrestricted access, branch on the
  role explicitly.
- Prefer **404 over 403** for another tenant's resource — a 403 confirms the ID
  exists.
- A listing is scoped by the authenticated `userId`. A `companyId` filter is an
  *additional restriction inside that scope*, never the scope itself.
- Beware `OR` clauses containing `undefined` — Prisma may match another owner's
  row.

**Never return in an HTTP response or a Swagger example:** `password`,
`refreshToken`, `asaasApiKey`, `cpfCnpj`, `incomeValue`, `walletId`,
`asaasCustomerId`, or a full residential address. Use an explicit `select`;
destructuring away only `password` is not sanitisation. Swagger is served
**without authentication** outside production, so a sensitive field in a
`schema.example` documents publicly which routes return it.

**Authentication.** Login failure always returns the same generic message
regardless of whether the e-mail exists. `forgot-password` always returns a
generic response. Never write a hardcoded fallback for a secret (`JWT_SECRET`,
`ENCRYPTION_SECRET`) — fail explicitly at startup instead. The global exception
filter must not overwrite the generic 500 message with `exception.message`.

**Payment state machine.** The transition to `CONFIRMED` belongs exclusively to
the authenticated Asaas webhook (and to the reconciliation job, which replays the
same handler). No manual endpoint may set `CONFIRMED` or `PENDING_PAYMENT`. A
late asynchronous event must not cancel an appointment already `CONFIRMED` or
`COMPLETED`.

**Webhooks never return 5xx.** Asaas webhooks are registered with
`sendType: 'SEQUENTIALLY'`: any response `>= 500` stalls that subaccount's queue
indefinitely and no later payment is confirmed. `POST /webhooks/asaas` always
returns 2xx; failures are logged, queued for reconciliation and alerted. Wrap
the whole handler — one unhandled exception is enough to stall the queue.

**Uploads.** Validate real binary magic bytes with `ValidateImage`, never the
client-declared `mimetype`, and check company ownership before writing
`logoPhoto` / `bannerPhoto`.

**Subaccount credentials.** The platform is the sole holder of each Asaas
subaccount's `asaasApiKey`, encrypted at rest with `CryptoHelper`.
Establishments are never granted access to the Asaas panel or API of their own
subaccount. Changing this is a product decision, not a support convenience —
escalate.

## 9. Business & billing rules

**Zero trust on financial payloads.** Monetary values, split amounts and fee
percentages are derived **server-side**. Never read them from the request body.

**Deposit — `CalculateDeposit`** (`src/helpers/calculate-deposit.helper.ts`):

```
price < R$ 15.00 ................... 100% upfront
price >= R$ 400 and configured 30% . 30%
otherwise .......................... 50%
final = max(calculated, min(price, R$ 15.00))
```

The percentage is normalised at service creation: below R$ 400 it is forced to
50%; only from R$ 400 up is 30% accepted. The client never chooses the fraction.

**Platform fee — `CalculateTax`** (`src/helpers/calculate-tax.helper.ts`):
cumulative brackets over the *deposit* — 10% up to R$ 250.00, 5% on the excess —
with a R$ 2.00 floor (`MIN_PLATFORM_TAX`) and ceiling rounding to multiples of
R$ 0.25, computed in integer cents. The fee is charged **on top of** the
deposit; the Pix total is `deposit + platform fee`.

**Gateway fee split is immutable.** The establishment's share of the Asaas Pix
fee is **fixed at R$ 0.99** (`BARBER_ASAAS_PIX_FEE`). It must never be derived
from the live Asaas fee, from `ASAAS_PIX_FEE`, or from `fetchAccountFees()`.
`AsaasService.gatewayPixCost` is a cost metric only — using it in a split
calculation is a regression.

**Historical pricing is frozen.** `servicePrice`, `downPaymentAmount` and
`platformFeeAmount` are persisted on the `Appointment` at creation. Never
recompute them from the live `Service` table for an existing booking.

**Onboarding gate.** Block service creation and booking when the company has no
valid `financialProfile.walletId`.

**Escrow.** Value from a `CONFIRMED` appointment is held; only `COMPLETED`
releases it for withdrawal.
`availableBalance = Σ deposit(COMPLETED) − Σ withdrawals(CONFIRMED + PENDING)`.

**Cancellation** (CDC Art. 51 / CC Arts. 417–420):

| Notice | Rule |
|---|---|
| `> 24h` | full refund of the amount paid online |
| `<= 24h` | **retain 100% of the deposit** as vacancy compensation. No partial refund. |

**Withdrawals.** Ad-hoc (`POST /company/withdraw`) carries the R$ 5.00 transfer
fee (`ASAAS_TRANSFER_FEE`). The weekly automatic payout (`@Cron('0 6 * * 1')`)
is free to the establishment and runs only for
`availableBalance >= R$ 100.00` (`MIN_FREE_WEEKLY_PAYOUT`); smaller balances
accumulate until they reach the floor.

**Anti-abuse limits** — business rules, not technical details. Changing any of
them requires explicit approval.

| Limit | Value |
|---|---|
| concurrent active appointments per client | 2 (`MAX_ACTIVE_APPOINTMENTS_PER_CLIENT`) |
| cancellations in 7 days before temporary block | 3 (`MAX_WEEKLY_CANCELLATIONS_LIMIT`) |
| Pix reservation validity | 15 minutes (`expiresAt`) |

## 10. Code style

- Identifiers in English (`camelCase` / `PascalCase`). Comments, log messages,
  user-facing exception messages and commits in **Portuguese**.
- A monetary variable carries its semantic unit in the name —
  `downPaymentAmount`, `platformFeeAmount`, `netAmountTransferred` — never a
  bare `value`, `amount` or `total`.
- Booleans start with a state verb: `isActive`, `isRefunded`, `isSystemManager`.
- Business constants live in `src/common/constants/billing.constant.ts` in
  `SCREAMING_SNAKE_CASE`, with a comment explaining **why** the number is what
  it is. No magic numbers inline.
- Guard clauses first, happy path last. One function, one job.
- Comment the **why**, not the **what**, and match the comment density of the
  surrounding file. A comment that misdescribes its function is a defect.
- An empty `catch` is acceptable only for the deliberate resilient e-mail
  dispatch (`.catch(() => {})`). Anywhere else it swallows an error.
- One `private readonly logger = new Logger(ClassName.name)` per service that
  logs, with a bracketed routine prefix (`[Cron Payouts]`, `[Webhook Asaas]`).
  Never log a secret, a token or a full PII payload.
- Before delivering: `npm run lint`, then `npm run test` (the whole suite).

## 11. Registered helpers — reuse, do not reimplement

| Helper | Path |
|---|---|
| `CalculateTax` — platform fee | `src/helpers/calculate-tax.helper.ts` |
| `CalculateDeposit` — deposit amount | `src/helpers/calculate-deposit.helper.ts` |
| `ValidateImage` — upload magic bytes | `src/helpers/validate-image.helper.ts` |
| `CryptoHelper` — AES-256-GCM at rest | `src/helpers/crypto.helper.ts` |
| `AllExceptionsFilter` — global errors | `src/common/filters/all-exceptions.filter.ts` |
| `PrismaClientExceptionFilter` — P2002→409, P2025→404 | `src/common/filters/prisma-client-exception.filter.ts` |
| `RolesGuard` — RBAC via `@Roles()` | `src/modules/auth/roles/guard/roles.guard.ts` |

When you add a reusable helper, put it in `src/helpers/` and add a row above.

## 12. Self-maintenance — keep this file true

A rule that lives only in code is a rule the next session will get wrong. These
updates ship in the **same** PR as the code, never "later".

**Helpers.** When you create a helper, generalize an existing one, extract
duplicated logic into `src/helpers/`, change a helper's formula, or remove one:
update the registry in §11 in the same PR. If the helper encodes a business
formula, also update where that formula is written in §9. An unregistered helper
gets reimplemented by the next agent.

**Business rules.** When a rule in §9 changes mid-development — a value, a
threshold, a policy, who pays what:

1. **Stop before writing code.** Restate the new rule in one sentence and get
   confirmation.
2. **Update §9 first**, then anywhere else in this file that repeats the rule.
3. **List the contradictions** — name the places in the code that now disagree.
   Do not fix them without approval.
4. **Then** write the code.

Documenting after the code works means not documenting: once it passes, the rule
is forgotten and the next session inherits a stale one.

## 13. External documentation

Asaas gateway: LLM index at `https://docs.asaas.com/llms.txt`. Append `.md` to
any documentation URL to read it as raw markdown.

Full endpoint catalogue with payloads: `docs/llm.md`.
