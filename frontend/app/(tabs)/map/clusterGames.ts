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
    const isCluster = cell.length > 1;
    return {
      ...cell[0],
      sport_type: dominantSport,
      // Only prefix place_id for genuine multi-game clusters. The Leaflet/Expo Go map
      // (ExpoGoMapScreen's handleMarkerPress) has no direct access to _isCluster over the
      // WebView bridge — it infers "is this a cluster?" purely from placeId.startsWith
      // ('cluster_'). Prefixing every grid cell's id (even a lone game) made every game
      // misidentified as a cluster whenever latDelta >= 0.015, forcing a zoom-in tap
      // instead of opening it directly.
      place_id: isCluster ? `cluster_${cell.map(c => c.place_id).join('_')}` : cell[0].place_id,
      geometry: { location: { lat: avgLat, lng: avgLng } },
      _isCluster: isCluster,
      _clusterCount: cell.length,
      _clusterItems: cell,
    };
  });
}
