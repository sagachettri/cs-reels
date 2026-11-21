import { ActivityDay } from '../models/ActivityDay.js';

// The user's local calendar day as YYYY-MM-DD. `offsetMinutes` = minutes the user's clock is ahead of UTC
// (India = 330), sent by the browser so streaks follow the student's own midnight.
export function dayKey(date = new Date(), offsetMinutes = 0) {
  return new Date(date.getTime() + offsetMinutes * 60000).toISOString().slice(0, 10);
}

export async function bumpActivity(userId, field, offsetMinutes = 0) {
  const day = dayKey(new Date(), offsetMinutes);
  await ActivityDay.updateOne(
    { user: userId, day },
    { $setOnInsert: { user: userId, day }, $inc: { [field]: 1 } },
    { upsert: true }
  );
}

const dayNumber = (key) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);

// current = consecutive active days ending today (or yesterday, so the streak is not lost before you study today).
export function computeStreaks(activeDayKeys, todayKey) {
  const numbers = new Set(activeDayKeys.map(dayNumber));
  const sorted = [...numbers].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let previous = null;
  for (const n of sorted) {
    run = previous !== null && n === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = n;
  }

  const today = dayNumber(todayKey);
  let cursor = numbers.has(today) ? today : today - 1;
  let current = 0;
  while (numbers.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}
