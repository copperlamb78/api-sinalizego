## 2026-08-23 - Prisma `include` and `select` Anti-pattern\n**Learning:** Using `select` inside an `include` block in Prisma causes a runtime and type validation error (`PrismaClientValidationError`). Prisma expects nested `select` blocks exclusively for relation projection.\n**Action:** Avoid mixing `select` and `include`. Use explicit, top-level `select` payloads with nested `select` to target exactly the fields needed.
## 2026-08-24 - Expensive nested loop Date parsing
**Learning:** `new Date(string).getTime()` is extremely slow when executed repeatedly inside a hot inner loop (like O(N*M) times).
**Action:** Always extract and memoize expensive Date parsing/conversions mapping it outside of hot inner loops to reduce redundant operations and achieve O(N) parsing complexity.
## 2026-08-25 - In-Memory Data Load for Summation
**Learning:** Fetching records into application memory using `findMany()` only to compute a sum via array operations (e.g. `reduce`) causes memory exhaustion and excessive deserealization latency when scaling.
**Action:** Use database-level aggregations (`prisma.aggregate({ _sum: { ... } })`) to offload the mathematical operations to the database and drastically reduce the Node.js process load and network footprint.

## 2026-08-26 - [Array Operations Optimization]
**Learning:** Found an instance in `company.service.ts` where arrays were being mapped/filtered multiple times sequentially instead of utilizing an existing `for (const appt of appointments)` loop that was already iterating through the same data.
**Action:** Avoid appending `.filter().reduce()` chains at the end of methods if the target array is already being iterated over. Compute sums and metrics in a single pass to minimize intermediate array allocations and O(n) passes.
## 2026-08-27 - Database Aggregation in Admin Service
**Learning:** Found an instance in `admin.service.ts` where transactions were fetched via `.findMany()` just to sum the `asaasFee`, creating unnecessary memory footprint.
**Action:** Replaced it with `.aggregate({ _sum: { asaasFee: true } })` to perform computation natively in the database, reducing memory consumption and processing time.
