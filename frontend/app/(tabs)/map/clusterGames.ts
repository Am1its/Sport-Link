import type { MapItem } from '../../../types';

export const SEARCH_AREA_THRESHOLD_KM = 2;

export type ClusterItem = MapItem & {
  _isCluster: boolean;
  _clusterCount: number;
  _clusterItems: MapItem[];
};

export function clusterGames(items: MapItem[], latDelta: number): ClusterItem[] {
  const valid = items.filter(i => {
    const { lat, lng } = i.geometry.location;
    return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
  });

  if (latDelta < 0.015) {
    return valid.map(i => ({ ...i, _isCluster: false, _clusterCount: 1, _clusterItems: [i] }));
  }

  const gridSize = latDelta / 2.5;
  const grid = new Map<string, MapItem[]>();
  for (const item of valid) {
    const key = `${Math.floor(item.geometry.location.lat / gridSize)},${Math.floor(item.geometry.location.lng / gridSize)}`;
    const cell = grid.get(key);
    if (cell) cell.push(item);
    else grid.set(key, [item]);
  }
  return Array.from(grid.values()).map(cell => {
    const avgLat = cell.reduce((s, i) => s + i.geometry.location.lat, 0) / cell.length;
    const avgLng = cell.reduce((s, i) => s + i.geometry.location.lng, 0) / cell.length;
    const sportCounts: Record<string, number> = {};
    cell.forEach(i => { sportCounts[i.sport_type] = (sportCounts[i.sport_type] ?? 0) + 1; });
    const dominantSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0][0];
    return {
      ...cell[0],
      sport_type: dominantSport,
      place_id: `cluster_${cell.map(c => c.place_id).join('_')}`,
      geometry: { location: { lat: avgLat, lng: avgLng } },
      _isCluster: cell.length > 1,
      _clusterCount: cell.length,
      _clusterItems: cell,
    };
  });
}
