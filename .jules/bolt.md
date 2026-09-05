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
## 2026-08-28 - [Date object optimization]
**Learning:** Avoid replacing local time `new Date(year, month, day, hour, min)` constructions with millisecond arithmetic `baseDateMs + minutes * 60000` because this breaks during Daylight Saving Time (DST) transitions.
**Action:** When trying to optimize date comparisons in a hot path, simply cache primitive results like `Date.now()` and `.getTime()` values to perform fast integer comparisons, rather than bypassing `new Date()` construction for specific local times.
## 2026-08-27 - Database Aggregation in Admin Service
**Learning:** Found an instance in `admin.service.ts` where transactions were fetched via `.findMany()` just to sum the `asaasFee`, creating unnecessary memory footprint.
**Action:** Replaced it with `.aggregate({ _sum: { asaasFee: true } })` to perform computation natively in the database, reducing memory consumption and processing time.
## 2026-09-05 - [Array Allocation in Hot Loops]
**Learning:** Calling `.filter(...).length` repeatedly within a hot loop (like a time-slot generator) creates costly intermediate array allocations and wastes CPU cycles by iterating over all items even when a condition (like `maxCapacity`) has already been met.
**Action:** Replace functional array chained methods inside hot loops with standard `for` loops and implement early exits (`break`) to eliminate unnecessary allocations and achieve O(1) space and faster execution.
