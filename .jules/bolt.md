## 2026-08-23 - Prisma `include` and `select` Anti-pattern\n**Learning:** Using `select` inside an `include` block in Prisma causes a runtime and type validation error (`PrismaClientValidationError`). Prisma expects nested `select` blocks exclusively for relation projection.\n**Action:** Avoid mixing `select` and `include`. Use explicit, top-level `select` payloads with nested `select` to target exactly the fields needed.
## 2026-08-24 - Expensive nested loop Date parsing
**Learning:** `new Date(string).getTime()` is extremely slow when executed repeatedly inside a hot inner loop (like O(N*M) times).
**Action:** Always extract and memoize expensive Date parsing/conversions mapping it outside of hot inner loops to reduce redundant operations and achieve O(N) parsing complexity.
