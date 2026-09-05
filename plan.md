1. Modify `src/modules/appointments/availability.service.ts` to optimize the `Date` object instantiations within the O(N) loop of `getAvailableSlots`. Specifically, precalculate times mathematically using milliseconds where `new Date().getTime()` is heavily used inside the loop, transforming loop checks to avoid continuous `Date` parsing.

```typescript
<<<<<<< SEARCH
      const slotStartHour = Math.floor(slotStartMinutes / 60);
      const slotStartMin = slotStartMinutes % 60;
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      const slotEndMin = slotEndMinutes % 60;

      const slotStartDate = new Date(
        Date.UTC(year, month - 1, day, slotStartHour, slotStartMin, 0),
      );
      const slotEndDate = new Date(
        Date.UTC(year, month - 1, day, slotEndHour, slotEndMin, 0),
      );

      // 2. Exclusão de horários passados caso a data consultada seja hoje
      // ⚡ Bolt: Cache slotStartMs early to do fast integer comparison instead of Date object comparison against now
      const slotStartMs = slotStartDate.getTime();
      if (slotStartMs <= nowMs) {
        continue;
      }

      // 3. Verificação de sobreposição com agendamentos existentes no grupo de serviço
      const slotEndMs = slotEndDate.getTime();
=======
      // Calculate start and end in milliseconds from the start of the UTC day
      const slotStartMs = dayStartFilter.getTime() + slotStartMinutes * 60000;
      const slotEndMs = dayStartFilter.getTime() + slotEndMinutes * 60000;

      // 2. Exclusão de horários passados caso a data consultada seja hoje
      // ⚡ Bolt: Cache slotStartMs early to do fast integer comparison instead of Date object comparison against now
      if (slotStartMs <= nowMs) {
        continue;
      }

      // 3. Verificação de sobreposição com agendamentos existentes no grupo de serviço
>>>>>>> REPLACE
```

2. Add journaling entry to `.jules/bolt.md`.
3. Complete pre commit instructions to ensure tests pass.
4. Submit the optimization.
