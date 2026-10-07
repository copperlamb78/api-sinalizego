# SinalizeGO — Regras de Governança e Transição da Equipe Multi-Agente (Backend API)

Este documento define a governança operacional obrigatória para os agentes que atuam na API SinalizeGO:
- **🏛️ Principal Engineer** (absorvendo PM, modelagem de banco e contratos de API)
- **💰 FinOps** (guardião das regras financeiras N1-N7 e Zero Trust)
- **💻 Developer** (desenvolvedor de código de produção NestJS / Prisma)
- **🔍 Reviewer** (auditor de qualidade de código, performance de queries e segurança)
- **🛡️ QA Engineer** (validador de critérios de aceite e testes automatizados Jest / Supertest)

---

## 1. Esteira Oficial de Transição de Tarefas

O fluxo de trabalho entre os agentes é estritamente sequencial e governado por portões lógicos:

```text
[Demanda do Usuário]
         │
         ▼
[🏛️ Principal Engineer] ──────▶ Cria docs/specs/<feature>-architecture.md
         │
         ▼
[💰 FinOps] ──────────────────▶ Valida cálculos e cria docs/specs/<feature>-financial-spec.md
         │
         ▼ (Portão DoR Aprovado)
[💻 Developer] ───────────────▶ Implementa em src/modules/ e src/common/
         │
         ▼
[🔍 Reviewer] ────────────────▶ Emite docs/reviews/<feature>-review.md
         │
         ├─── (STATUS: CHANGES_REQUESTED) ──▶ Devolve para [💻 Developer]
         │
         ▼ (STATUS: APPROVED)
[🛡️ QA Engineer] ─────────────▶ Executa testes unitários/e2e e emite docs/qa/<feature>-qa-report.md
         │
         ├─── (STATUS: REJECTED) ───────────▶ Devolve para [💻 Developer]
         │
         ▼ (STATUS: APPROVED)
    [🎉 Tarefa Concluída & Commit Semântico]
```

---

## 2. Portão de DoR (Definition of Ready)
O agente **Developer** está **programaticamente bloqueado** de criar ou editar qualquer arquivo de código em `src/` enquanto:
1. O arquivo `docs/specs/<feature>-architecture.md` não existir ou não contiver status `READY_FOR_FINOPS` ou `APPROVED_DOR`.
2. O arquivo `docs/specs/<feature>-financial-spec.md` não existir com status `APPROVED_DOR`.
3. As regras de negócio N1–N7 (`docs/modelo-de-negocio.md`) não tiverem sido confirmadas.

---

## 3. Sandboxing & Isolamento de Ferramentas por Papel

| Papel | Permissão de ESCRITA Permitida | Permissão de ESCRITA Proibida |
|---|---|---|
| **🏛️ Principal Engineer** | `docs/specs/`, `prisma/schema.prisma` (rascunho de spec) | `src/`, `test/` |
| **💰 FinOps** | `docs/specs/` | `src/`, `test/` |
| **💻 Developer** | `src/modules/`, `src/common/` | `docs/specs/`, `test/` (fora do escopo de testes unitários) |
| **🔍 Reviewer** | `docs/reviews/` | `src/`, `test/` |
| **🛡️ QA Engineer** | `test/`, `docs/qa/` | `src/modules/` (estritamente leitura de código) |

---

## 4. Protocolo de Veto (Reviewer e QA)

1. **Veto do Reviewer (`STATUS: CHANGES_REQUESTED`):**
   - Se o código violar convenções do NestJS, apresentar tipagem frágil (`any`), queries propensas a N+1 ou falta de validação em DTOs, o Reviewer emite `docs/reviews/<feature>-review.md` com `STATUS: CHANGES_REQUESTED`.
   - O fluxo reseta imediatamente para o **Developer**, que deve aplicar as correções pontuais.
2. **Veto do QA (`STATUS: REJECTED`):**
   - Se qualquer critério de aceite falhar, houver quebra em testes unitários/integração ou exceções não tratadas, o QA emite `docs/qa/<feature>-qa-report.md` com `STATUS: REJECTED`.
   - O fluxo reseta imediatamente para o **Developer**, anexando os passos de reprodução do defeito.

---

## 5. Prevenção de Loops Infinitos & Human-in-the-Loop (`max_iter: 3`)

Para evitar desperdício de tokens e discussões circulares entre os agentes:
- Cada ciclo de correção entre **Developer ⇄ Reviewer** ou **Developer ⇄ QA** incrementa o contador de iteração (`1/3`, `2/3`, `3/3`).
- **Gatilho de Human-in-the-Loop:** Se uma tarefa atingir a **3ª rejeição consecutiva (`3/3`)**, o fluxo é pausado imediatamente. O agente deve parar a execução, notificar o usuário no chat com o histórico das 3 tentativas e solicitar orientação humana para desempatar a decisão técnica.

---

## 6. Persistência de Memória em Disco (State Persistence)

Para manter o contexto limpo e evitar alucinações em cascata:
- As decisões nunca dependem exclusivamente da memória do chat.
- Cada etapa grava seu estado em arquivos Markdown estruturados no disco:
  - `docs/specs/<feature>-architecture.md`
  - `docs/specs/<feature>-financial-spec.md`
  - `docs/reviews/<feature>-review.md`
  - `docs/qa/<feature>-qa-report.md`
- O próximo agente lê o arquivo do agente anterior como input direto da sua execução.
