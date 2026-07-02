const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type DateRange = { date_from: string; date_to: string };

export function getTodayRange(): DateRange {
  const today = toDateStr(new Date());
  return { date_from: today, date_to: today };
}

export function getThisWeekendRange(): DateRange {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  // Next Saturday (day 6); if today is Sat use today; if Sun use next Sat
  const daysToSat = day === 6 ? 0 : (6 - day);
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return { date_from: toDateStr(sat), date_to: toDateStr(sun) };
}

export function getThisWeekRange(): DateRange {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysToSun = (7 - day) % 7 || 7; // days until next Sunday
  const endSun = new Date(now);
  endSun.setDate(now.getDate() + daysToSun);
  return { date_from: toDateStr(now), date_to: toDateStr(endSun) };
}

// Parses the backend's 'YYYY-MM-DD HH:MM' scheduled_time format into a device-local Date.
// `new Date('YYYY-MM-DD HH:MM')` is non-ISO and engine-dependent — always split and construct.
export function parseGameTime(scheduledTime: string | null | undefined): Date | null {
  if (!scheduledTime) return null;
  const [datePart, timePart] = scheduledTime.split(' ');
  if (!datePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart || '00:00').split(':').map(Number);
  if ([year, month, day, hour, minute].some(n => isNaN(n))) return null;
  return new Date(year, month - 1, day, hour, minute);
}

export const isPastGame = (scheduledTime: string | null | undefined): boolean => {
  const d = parseGameTime(scheduledTime);
  return d != null && d < new Date();
};

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatChatTimestamp = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
