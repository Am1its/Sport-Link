export const SPORT_COLORS: Record<string, string> = {
  basketball: '#FF8C00',
  tennis:     '#CCFF00',
  volleyball: '#FFD700',
  football:   '#FFFFFF',
  yoga:       '#A78BFA',
  gym:        '#FB923C',
  studio:     '#F472B6',
  footvolley: '#22D3EE',
};

export const SPORT_ICONS: Record<string, string> = {
  basketball: 'basketball',
  tennis:     'tennis',
  volleyball: 'volleyball',
  football:   'soccer',
  yoga:       'yoga',
  gym:        'dumbbell',
  studio:     'dance-ballroom',
  footvolley: 'volleyball',
};

// { key, label } pairs used by map and discover filter rows
export const SPORT_FILTER_ITEMS = [
  { key: 'all',        label: 'All Sports' },
  { key: 'basketball', label: '🏀' },
  { key: 'football',   label: '⚽' },
  { key: 'tennis',     label: '🎾' },
  { key: 'volleyball', label: '🏐' },
  { key: 'yoga',       label: '🧘' },
  { key: 'gym',        label: '🏋️' },
  { key: 'studio',     label: '💃' },
  { key: 'footvolley', label: '🏖️' },
] as const;
