export type SportPref = {
  sport_type: string;
  skill_level: number;
  is_favorite: number | boolean;
};

export type Game = {
  id: number;
  place_id?: string;
  sport_type: string;
  level: number;
  title: string | null;
  scheduled_time: string | null;
  location_desc: string | null;
  equipment_notes: string | null;
  max_players: number | null;
  participant_count: number;
  host_id?: number;
  is_host?: boolean;
  is_joined?: boolean;
  status?: string;
  created_at?: string;
  photo: string | null;
  recurrence?: 'none' | 'weekly' | 'biweekly';
};

export type MapItem = {
  id?: number;
  place_id: string;
  name: string;
  sport_type: string;
  rating: number | string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  isLocalGame?: boolean;
  venue_type?: 'court' | 'gym' | 'studio' | 'facility';
  host_id?: number;
  max_players?: number | null;
  participant_count?: number;
  scheduled_time?: string | null;
  is_joined?: boolean;
};

export type Participant = {
  id: number;
  username: string;
  avatar: string | null;
  role: string;
};

export type UserProfile = {
  id: number;
  username: string;
  bio: string | null;
  avatar: string | null;
  games_hosted: number;
  games_joined: number;
  karma: number;
  top_sport: string | null;
  sport_preferences: SportPref[];
};

export type Friend = {
  friendship_id: number;
  id: number;
  username: string;
  avatar: string | null;
  karma: number;
};

export type DirectMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string | null;
  type: 'text' | 'event';
  event_id: number | null;
  is_read: boolean;
  created_at: string;
  game_title?: string | null;
  game_sport?: string | null;
  game_time?: string | null;
  game_location?: string | null;
  game_max_players?: number | null;
  game_status?: string | null;
  game_current_players?: number;
  game_joined?: number;
  game_is_host?: number;
};
