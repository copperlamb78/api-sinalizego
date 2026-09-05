const year = 2023, month = 10, day = 25;
const slotStartMinutes = 10 * 60 + 30; // 10:30

const slotStartHour = Math.floor(slotStartMinutes / 60);
const slotStartMin = slotStartMinutes % 60;

const d1 = new Date(Date.UTC(year, month - 1, day, slotStartHour, slotStartMin, 0)).getTime();
const d2 = Date.UTC(year, month - 1, day, 0, 0, 0, 0) + slotStartMinutes * 60000;

console.log('d1', d1);
console.log('d2', d2);
console.log('match?', d1 === d2);
