1.  **Vulnerability**: Replaces raw `console.error` calls with the `Logger` instance in `AsaasService` to prevent leaking detailed stack traces and raw error objects to standard output (which can be collected by external log aggregators). This addresses a medium severity information disclosure/logging security issue.
2.  **Files to change**: `src/asaas/asaas.service.ts`
3.  **Pre-commit checks**: Run `pnpm format`, `pnpm lint`, and `pnpm test` to ensure changes don't break existing functionality and follow code styles.
