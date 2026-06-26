/**
 * Israel timezone utilities.
 * scheduled_time is stored as 'YYYY-MM-DD HH:MM' in Israel local time (IDT/IST).
 * Railway MySQL server runs UTC, so raw NOW() comparisons are wrong.
 */

/**
 * SQL expression that returns the current time in Israel local time.
 * Use wherever MySQL NOW() is compared against stored scheduled_time strings.
 * CONVERT_TZ requires timezone tables; on Railway MySQL these are available.
 */
const ISRAEL_NOW_SQL = `CONVERT_TZ(NOW(), '+00:00', '+03:00')`;

/**
 * Parse a stored 'YYYY-MM-DD HH:MM' Israel-local string into a JS Date (UTC instant).
 * Israel uses IDT (UTC+3) in summer and IST (UTC+2) in winter.
 * We use the Intl API to determine the correct offset for the specific date.
 */
function parseIsraelTime(str) {
  if (!str) return null;
  const [datePart, timePart = '00:00'] = str.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart + ':00').split(':').map(Number);

  // Build a candidate UTC instant assuming the stored time is UTC,
  // then determine the actual Israel offset at that date to correct it.
  const candidateUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Get what Israel's wall clock says for this candidate UTC instant.
  const israelParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(candidateUtc);

  const p = {};
  for (const part of israelParts) p[part.type] = part.value;
  const israelWallMs = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second)
  );

  // offsetMs: how many ms Israel is ahead of UTC at this moment
  const offsetMs = israelWallMs - candidateUtc.getTime();

  // Correct the candidate: Israel local → UTC = local - offset
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMs);
}

module.exports = { ISRAEL_NOW_SQL, parseIsraelTime };
