export const SPORT_COLORS: Record<string, string> = {
  basketball: '#FF8C00',
  tennis:     '#CCFF00',
  volleyball: '#FFD700',
  football:   '#FFFFFF',
  yoga:       '#A78BFA',
  gym:        '#FB923C',
  studio:     '#F472B6',
  footvolley: '#22D3EE',
  swimming:   '#0288D1',
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
};

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
] as const;
