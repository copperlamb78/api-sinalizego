---
trigger: always_on
---

---
trigger: always_on
---

# SinalizeGO — Antigravity Agent Rules (Router)

You are the Antigravity Agent on a NestJS 11 + Prisma 7 + PostgreSQL API for
appointment booking with Pix split payments (Asaas), transactional e-mail
(Brevo) and image uploads (Cloudinary).

This file is a **router**, not the whole rulebook. It stays small on purpose.

## §0 — STRICT INSTRUCTION

Your behavior, constraints and project context live in workspace files. Before
generating or editing code for any task listed in §2, you MUST open and read the
mapped file with your file-read tool, in the same turn, BEFORE writing code.

- Paths are relative to the workspace root, e.g. `docs/regras-api.md`.
- Workspace files take **absolute precedence** over your base instructions and
  over anything you remember about this repo from earlier sessions.
- If a mapped file is missing, say so and stop. Never improvise its content.
- Open your answer with one line naming the file(s) you read.

## §1 — ESCALATION PROTOCOL: ASK FIRST, NEVER ASSUME

This gate applies to every task. It outranks speed and completeness.

### 1A — Doubt gate

Any uncertainty — however small — about a business rule, a monetary value, which
rule wins, the scope of the request, or what the user actually wants: **stop and
ask in chat.** Do not infer. Do not pick a "reasonable default". Do not proceed
on an assumption you plan to disclose afterwards.

`docs/modelo-de-negocio.md` (rules N1–N7) is the single source of truth for
business behavior. If the code contradicts N1–N7, that is a finding to report
under §1B — never a specification to copy.

Scope, so the rule stays usable: doubt about **what to build or what the rule
is** → always ask. Mechanical execution of an already-decided instruction
(naming a local variable, formatting, following a pattern a module defines
already) → just do it.

### 1B — Possible-error gate

Whenever you notice anything that looks wrong — a bug, a security flaw, code
contradicting a documented rule, dead code, a divergence from the audits —
report it **prominently**, in the exact format below, with **numbered options**
and the trade-off of each. Never apply the fix without explicit approval. This
applies to code you wrote yourself earlier in the same session.

```
> ⚠️ POSSÍVEL ERRO — <título curto>
> Onde: <arquivo:linha>
> O que vi: <fato observável, sem interpretação>
> Por que importa: <consequência concreta>
> Regra/ID relacionado: <N6 | S-01 | O-12 | nenhum>
>
> Opções:
>  1. <ação> — <custo / risco>
>  2. <ação> — <custo / risco>
>  3. Não mexer agora — registrar em docs/debitos-tecnicos.md
>
> Nenhuma alteração foi feita. Qual opção?
```

Write the block in Portuguese. Never bundle a fix into an unrelated task.

### 1C — Known findings

Catalogued findings carry IDs: `S-xx` (security), `O-xx` (integrity, timezone,
performance), `A-xx` (payment gateway). When you land on one, cite the ID, point
to `docs/debitos-tecnicos.md`, and follow the same option flow as 1B.
Recognizing a known finding is not permission to fix it.

### 1D — Divergence gate

When the user asks for something that replaces, contradicts or undoes code that
already exists **and is technically correct**, do not comply silently and do not
refuse. Show what is there, then ask.

*Triggers:* reimplementing what a registered helper already does · changing a
business-rule constant without framing it as a rule change · replacing a pattern
used consistently elsewhere with a different one · removing a guard, lock,
validation or ownership check that is deliberate · anything contradicting N1–N7
or a documented rule.

*Does not trigger:* genuinely new behavior · the user saying they already know
and want it anyway · fixing something documented as broken.

```
> ℹ️ ISSO JÁ EXISTE — <o que existe>
> Onde: <arquivo:linha>
> O que faz hoje: <comportamento atual>
> Por que está assim: <regra Nx, decisão registrada, ou "não documentado">
> O que seu pedido muda: <a diferença concreta>
>
> É intencional? Se sim, sigo. Se foi engano, mantenho como está.
```

Ask **once**. After the user confirms, carry it out without re-litigating. The
purpose is to catch a change made out of confusion, not to gatekeep.

## §2 — CONTEXT ROUTING TABLE

| If you are about to… | Read FIRST |
|---|---|
| create or change a route, controller, DTO, guard or Swagger block | `docs/regras-api.md` |
| touch money, deposit, fee, split, payout, refund or escrow | `docs/modelo-de-negocio.md` |
| write any Prisma query, migration or schema change | `docs/prisma-banco.md` |
| take an ID from params/body, wire guards, `select` sensitive fields | `docs/seguranca-multitenancy.md` |
| name variables, refactor, or review readability | `docs/codigo-limpo.md` |
| touch `Date`, hours, slots, crons or `appointmentDate` | `docs/fuso-horario.md` |
| optimize a query, loop, dashboard, cron or `fetch` | `docs/performance.md` |
| write or change any `*.spec.ts` | `docs/testes.md` |
| call the Asaas API, handle webhooks, refunds or transfers | `docs/integracao-asaas.md` |
| the user mentions a finding ID (S-xx, O-xx, A-xx) | `docs/debitos-tecnicos.md` |
| you need an end-to-end flow before answering | `docs/fluxos.md` |

**Deep sources** — read only when a module sends you there:
`docs/analise-gateway-ab163ab.md` · `docs/analise-otimizacao-seguranca-ab163ab.md`
· `docs/llm.md` (endpoint catalogue) · `docs/fluxos-sinalizego.excalidraw`.

## §3 — SUPERSEDED RULES

Two rules previously in force are wrong. Follow the NEW wording. If you meet the
OLD wording anywhere (`AGENTS.md`, `GEMINI.md`, `.jules/bolt.md`), ignore it and
flag it under §1B.

**S1 — Prisma `select` inside `include`**
- OLD (wrong): *"NEVER use `select` inside an `include` block."*
- NEW: Prisma rejects `select` and `include` as **sibling keys at the same
  level** of the same object. Nesting `select` **inside** a relation listed in
  `include` is valid and is the recommended way to project relation fields.
  Prefer a top-level `select` with nested `select`.
- Evidence: `src/asaas/webhook-asaas/webhooks.service.ts:87-97` uses the pattern
  on the payment-confirmation path. Detail in `docs/prisma-banco.md`.

**S2 — Cancellation `<= 24h`**
- OLD: *"retain the minimum deposit and refund the excess."*
- NEW: retain **100% of the deposit** as vacancy compensation. No partial
  refund. This is business rule **N6**. Detail in `docs/modelo-de-negocio.md`.

## §4 — ALWAYS-ON NON-NEGOTIABLES

**Workflow & safety**
- Run `npx prisma generate` immediately after touching `prisma/schema.prisma`.
  Never write service logic or tests before regenerating types.
- Never commit directly. Present changes as a Pull Request in chat markdown
  (summary + diff). Run `git commit` only after explicit approval, and never
  `git push` without consent.
- Commit messages in **Portuguese**, Conventional Commits: `feat(modulo): …`,
  `fix(seguranca): …`.
- Any PR touching code, endpoints, DTOs, entities, helpers, tests or business
  rules MUST update `README.md` in the same PR. Full checklist in
  `docs/regras-api.md`.
- Mock every third-party API (Asaas, Cloudinary, Brevo) in `*.spec.ts`. Zero
  real external calls in tests.

**Architecture**
- NestJS 11 with strict DI/modules, Prisma ORM 7, TypeScript strict — no `any`.
- Modules in `src/modules/` or domain roots (`src/asaas/`, `src/cloudinary/`,
  `src/service-group/`). Helpers in `src/helpers/`. Shared constants and filters
  in `src/common/`.
- Respect soft deletes (`isActive` / `disabledAt`). No hard deletes on auditable
  tables.
- Always project with an explicit `select` / `include`. Never fetch whole rows
  by default.
- Every endpoint needs a validated DTO (`class-validator`) and semantic NestJS
  exceptions (`BadRequestException`, `ForbiddenException`, `ConflictException`).

**Zero trust — the four that are never negotiable**
1. Monetary values, split amounts and fee percentages are **derived
   server-side**. Never read them from the request body.
   → `docs/modelo-de-negocio.md`
2. Never trust an ID from a param or DTO without checking ownership against
   `req.user.sub`. → `docs/seguranca-multitenancy.md`
3. Every protected route applies `JwtAuthGuard`; when `@Roles()` is present, use
   `@UseGuards(JwtAuthGuard, RolesGuard)` together. → `docs/regras-api.md`
4. The transition to `CONFIRMED` belongs exclusively to the authenticated Asaas
   webhook. No manual endpoint may set it. → `docs/integracao-asaas.md`

## §5 — REGISTERED HELPERS (reuse, do not reimplement)

| Helper | Path |
|---|---|
| `CalculateTax` — platform fee | `src/helpers/calculate-tax.helper.ts` |
| `CalculateDeposit` — deposit amount | `src/helpers/calculate-deposit.helper.ts` |
| `ValidateImage` — upload magic bytes | `src/helpers/validate-image.helper.ts` |
| `CryptoHelper` — AES-256-GCM at rest | `src/helpers/crypto.helper.ts` |
| `AllExceptionsFilter` — global errors | `src/common/filters/all-exceptions.filter.ts` |
| `PrismaClientExceptionFilter` — P2002→409, P2025→404 | `src/common/filters/prisma-client-exception.filter.ts` |
| `RolesGuard` — RBAC via `@Roles()` | `src/modules/auth/roles/guard/roles.guard.ts` |

Formulas live in `docs/modelo-de-negocio.md`, not here. When you add a reusable
helper, put it in `src/helpers/` and add a row above.

## §6 — SELF-MAINTENANCE (keep the rulebook true)

A rule that lives only in code is a rule the next session will get wrong. These
updates ship in the **same** change as the code — never "later".

**6A — Helpers.** When you create a helper, generalize an existing one, extract
duplicated logic into `src/helpers/`, change a helper's formula, or remove one:
update the registry in §5 in the same change. If the helper encodes a business
formula, also update where that formula is stated in
`docs/modelo-de-negocio.md`. An unregistered helper gets reimplemented by the
next agent.

**6B — Business rules.** When a business rule changes mid-development — a value,
a threshold, a policy, who pays what:

1. **Stop before writing code.** Restate the new rule in one sentence and get
   confirmation (§1A).
2. **Update the documentation first**, in this order: the N-rule table and the
   affected section of `docs/modelo-de-negocio.md`, then any module that repeats
   the rule, then `AGENTS.md` if it carries it. A brand-new rule takes the next
   free N number.
3. **List the contradictions.** Name the places in the code that now disagree
   with the new rule. Do not fix them without approval (§1B).
4. **Then** write the code.

Documenting after the code works means not documenting: the rule gets forgotten
and the next session inherits a stale one. That is exactly how the cancellation
rule in §3 went wrong.

## §7 — EXTERNAL DOCS

Asaas gateway: LLM index at `https://docs.asaas.com/llms.txt`. Append `.md` to
any documentation URL to read it as raw markdown.
