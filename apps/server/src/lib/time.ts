const DAILY_RESET_HOUR_UTC = 1;

export function getRewardDateKey(now = new Date()): string {
  const shifted = new Date(now.getTime() - DAILY_RESET_HOUR_UTC * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function getNextResetIso(now = new Date()): string {
  const next = new Date(now);
  next.setUTCHours(DAILY_RESET_HOUR_UTC, 0, 0, 0);
  if (now >= next) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}
