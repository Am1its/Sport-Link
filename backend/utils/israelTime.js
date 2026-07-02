/**
 * Israel timezone utilities.
 * scheduled_time is stored as 'YYYY-MM-DD HH:MM' in Israel local time (IDT/IST).
 * Railway MySQL server runs UTC, so raw NOW() comparisons are wrong.
 */

/**
 * Returns the current instant's Israel local wall-clock time as 'YYYY-MM-DD HH:MM:SS'.
 * Computed in Node via Intl (correctly handles the IDT/IST DST transition), then bound
 * as a SQL parameter — e.g. `DATE_SUB(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), INTERVAL 3 HOUR)`.
 * Avoids relying on MySQL CONVERT_TZ named-zone support, which requires timezone
 * tables that may not be loaded on every MySQL host (and a fixed '+03:00' offset,
 * used previously, is wrong for the ~5 winter months when Israel is UTC+2).
 */
function israelNowString() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const p = {};
  for (const part of parts) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second}`;
}

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

module.exports = { israelNowString, parseIsraelTime };
