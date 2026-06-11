import { apiFetch } from './api';

export type GeoResult = { name: string; lat: number; lng: number };

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const res  = await apiFetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res  = await apiFetch(`/api/geocode?reverse=1&lat=${lat}&lng=${lng}`);
    const data = await res.json();
    return data.neighborhood ?? null;
  } catch {
    return null;
  }
}
