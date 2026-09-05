const year = 2023, month = 1, day = 1;
const slotStartMinutes = 10 * 60 + 30; // 10:30
const durationMinutes = 45;

const dayStartFilter = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
const dayStartMs = dayStartFilter.getTime();

const slotStartHour = Math.floor(slotStartMinutes / 60);
const slotStartMin = slotStartMinutes % 60;
const slotEndMinutes = slotStartMinutes + durationMinutes;
const slotEndHour = Math.floor(slotEndMinutes / 60);
const slotEndMin = slotEndMinutes % 60;

const slotStartDate = new Date(Date.UTC(year, month - 1, day, slotStartHour, slotStartMin, 0));
const slotEndDate = new Date(Date.UTC(year, month - 1, day, slotEndHour, slotEndMin, 0));

const optStartMs = dayStartMs + slotStartMinutes * 60000;
const optEndMs = dayStartMs + slotEndMinutes * 60000;

console.log(slotStartDate.getTime() === optStartMs);
console.log(slotEndDate.getTime() === optEndMs);
