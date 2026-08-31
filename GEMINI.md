# SinalizeGO — Agent Context

> This file is a pointer. The full rulebook lives in the workspace and is split
> by topic so that only the relevant part is loaded per task.

## Read this first

Open `docs/RULES.md` before doing anything else. It is the router: it carries
the always-on rules and a table mapping each kind of task to the file you must
read before writing code.

If `docs/RULES.md` is not present in your workspace, you are running without the
project rulebook — say so and stop. Do not improvise its content. In that case
`AGENTS.md` at the repository root is the self-contained fallback.

## Routing summary

| If you are about to… | Read first |
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
| you need an end-to-end flow before answering | `docs/fluxos.md` |

`docs/RULES.md` carries the complete routing table, including entries not
summarised here.

## Non-negotiable, even before you read anything

1. **Ask first, never assume.** Any doubt about a business rule, a monetary
   value or the scope of the request: stop and ask. No "reasonable defaults".
2. **Never fix without approval.** Report a suspected defect prominently, with
   numbered options and their trade-offs, and wait.
3. **Flag divergence from working code.** If the request replaces or undoes
   something that already exists and is technically correct, show what is there
   and ask whether the change is intentional before doing it. Ask once, then
   carry out the decision.
4. **Keep the rulebook true.** A new or generalized helper updates the helper
   registry, and a changed business rule updates the documentation *before* the
   code — both in the same change.
5. **Never commit to `main` and never `git push` without consent.** Present work
   as a Pull Request. Commit messages in Portuguese, Conventional Commits.
6. **Financial values are derived server-side**, never read from a request body.
7. **`CONFIRMED` is set only by the authenticated Asaas webhook.**

Precedence: workspace files > this file > anything you remember about this repo
from an earlier session.
