import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard } from 'react-native';
import { searchPlaces, GeoResult } from '../../../utils/geocode';

const RECENT_SEARCHES_KEY = 'map_recent_searches';

export function useMapSearch() {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<GeoResult[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then(raw => { if (raw) setRecentSearches(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (text.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);
  };

  const collapseSearch = () => {
    setSearchExpanded(false);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const saveRecentSearch = (place: GeoResult) => {
    setRecentSearches(prev => {
      const next = [place, ...prev.filter(r => r.name !== place.name)].slice(0, 5);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return {
    searchExpanded,
    setSearchExpanded,
    searchQuery,
    searchResults,
    searchLoading,
    recentSearches,
    handleSearchChange,
    collapseSearch,
    saveRecentSearch,
  };
}
