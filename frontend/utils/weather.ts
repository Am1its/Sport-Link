// Maps WMO weather codes to { condition, icon }
// https://open-meteo.com/en/docs#weathervariables
const WMO_MAP: Record<number, { condition: string; icon: string }> = {
  0:  { condition: 'Clear',       icon: '☀️' },
  1:  { condition: 'Mostly clear', icon: '🌤️' },
  2:  { condition: 'Partly cloudy', icon: '⛅' },
  3:  { condition: 'Overcast',    icon: '☁️' },
  45: { condition: 'Foggy',       icon: '🌫️' },
  48: { condition: 'Icy fog',     icon: '🌫️' },
  51: { condition: 'Light drizzle', icon: '🌦️' },
  53: { condition: 'Drizzle',     icon: '🌦️' },
  55: { condition: 'Heavy drizzle', icon: '🌧️' },
  61: { condition: 'Light rain',  icon: '🌧️' },
  63: { condition: 'Rain',        icon: '🌧️' },
  65: { condition: 'Heavy rain',  icon: '🌧️' },
  71: { condition: 'Light snow',  icon: '🌨️' },
  73: { condition: 'Snow',        icon: '❄️' },
  75: { condition: 'Heavy snow',  icon: '❄️' },
  80: { condition: 'Showers',     icon: '🌦️' },
  81: { condition: 'Rain showers', icon: '🌧️' },
  82: { condition: 'Heavy showers', icon: '⛈️' },
  95: { condition: 'Thunderstorm', icon: '⛈️' },
  99: { condition: 'Hail storm',  icon: '⛈️' },
};

export type WeatherResult = {
  tempC: number;
  condition: string;
  icon: string;
};

const OUTDOOR_SPORTS = new Set(['basketball', 'tennis', 'volleyball', 'football', 'footvolley', 'padel', 'hiking', 'walking']);

// Session cache keyed by gameId
const cache = new Map<number | string, WeatherResult | null>();

export function isOutdoorSport(sport: string): boolean {
  return OUTDOOR_SPORTS.has(sport);
}

export async function fetchWeatherForGame(
  gameId: number | string,
  lat: number,
  lng: number,
  scheduledTime: string // 'YYYY-MM-DD HH:MM'
): Promise<WeatherResult | null> {
  if (cache.has(gameId)) return cache.get(gameId) ?? null;

  try {
    const [datePart, timePart] = scheduledTime.split(' ');
    if (!datePart || !timePart) return null;
    const hour = parseInt(timePart.split(':')[0]);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode&timezone=Asia%2FJerusalem&start_date=${datePart}&end_date=${datePart}`;
    const res = await fetch(url);
    if (!res.ok) { cache.set(gameId, null); return null; }
    const data = await res.json();

    const temps: number[] = data?.hourly?.temperature_2m ?? [];
    const codes: number[] = data?.hourly?.weathercode ?? [];
    const tempC  = Math.round(temps[hour] ?? temps[0] ?? 0);
    const code   = codes[hour] ?? codes[0] ?? 0;
    const meta   = WMO_MAP[code] ?? { condition: 'Unknown', icon: '🌡️' };
    const result: WeatherResult = { tempC, ...meta };
    cache.set(gameId, result);
    return result;
  } catch {
    cache.set(gameId, null);
    return null;
  }
}
