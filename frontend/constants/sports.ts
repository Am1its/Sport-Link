/**
 * All supported sport keys — single source of truth.
 * Use SportType for typed sport parameters throughout the app.
 */
export const SPORT_TYPES = [
  'basketball', 'tennis', 'volleyball', 'football',
  'yoga', 'gym', 'studio', 'footvolley', 'swimming',
  'padel', 'hiking', 'walking',
] as const;

export type SportType = typeof SPORT_TYPES[number];

export const SPORT_COLORS: Record<string, string> = {
  basketball: '#FF8C00',
  tennis:     '#CCFF00',
  volleyball: '#FFD700',
  football:   '#16A34A',
  yoga:       '#A78BFA',
  gym:        '#FB923C',
  studio:     '#F472B6',
  footvolley: '#22D3EE',
  swimming:   '#0288D1',
  padel:      '#F43F5E',
  hiking:     '#22C55E',
  walking:    '#64748B',
};

export const SPORT_ICONS: Record<string, string> = {
  basketball: 'basketball',
  tennis:     'tennis',
  volleyball: 'volleyball',
  football:   'soccer',
  yoga:       'yoga',
  gym:        'dumbbell',
  studio:     'dance-ballroom',
  footvolley: 'handball',
  swimming:   'swim',
  padel:      'table-tennis',
  hiking:     'hiking',
  walking:    'walk',
};

export const SPORT_LABELS: Record<string, string> = {
  basketball: 'Basketball',
  football:   'Football',
  tennis:     'Tennis',
  volleyball: 'Volleyball',
  yoga:       'Yoga',
  gym:        'Gym',
  studio:     'Studio',
  footvolley: 'Footvolley',
  swimming:   'Swimming',
  padel:      'Padel',
  hiking:     'Hiking',
  walking:    'Walking',
};

export function sportLabel(type: string): string {
  return SPORT_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1));
}

// { key, label } pairs used by map and discover filter rows
export const SPORT_FILTER_ITEMS = [
  { key: 'all',        label: 'All Sports' },
  { key: 'basketball', label: 'Basketball' },
  { key: 'football',   label: 'Football' },
  { key: 'tennis',     label: 'Tennis' },
  { key: 'volleyball', label: 'Volleyball' },
  { key: 'yoga',       label: 'Yoga' },
  { key: 'gym',        label: 'Gym' },
  { key: 'studio',     label: 'Studio' },
  { key: 'footvolley', label: 'Footvolley' },
  { key: 'swimming',   label: 'Swimming' },
  { key: 'padel',      label: 'Padel' },
  { key: 'hiking',     label: 'Hiking' },
  { key: 'walking',    label: 'Walking' },
] as const;
