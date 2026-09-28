const timeZone = "Asia/Karachi";

export const businessDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const shiftBusinessDate = (date, days) => {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

export const millisecondsUntilNextBusinessDay = (now = new Date()) => {
  const nextDate = shiftBusinessDate(businessDate(now), 1);
  const nextMidnight = new Date(`${nextDate}T00:00:00+05:00`).getTime();
  return Math.max(1000, nextMidnight - now.getTime() + 1000);
};
