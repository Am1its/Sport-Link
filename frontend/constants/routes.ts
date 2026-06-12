/**
 * Central screen route path constants.
 * Use with router.push / router.replace instead of hard-coded strings.
 */

export const ROUTES = {
  LOGIN:                  '/login',
  REGISTER:               '/register',
  ONBOARDING:             '/onboarding',

  // Tabs
  TABS:                   '/(tabs)',
  GAMES_TAB:              '/(tabs)/games',
  PROFILE_TAB:            '/(tabs)/profile',

  // Game flow
  MODAL:                  '/modal',
  GAME_CHAT:              '/game-chat',
  GAME_PARTICIPANTS:      '/game-participants',
  RATE_PLAYERS:           '/rate-players',
  GAME_RESULTS:           '/game-results',

  // Social
  FRIENDS:                '/friends',
  DIRECT_CHAT:            '/direct-chat',
  PLAYER_PROFILE:         '/player-profile',
  PLAYER_MATCHING:        '/player-matching',
  LEADERBOARD:            '/leaderboard',
  ACTIVITY:               '/activity',
  BLOCKED_USERS:          '/blocked-users',

  // Courts
  COURT_DETAIL:           '/court-detail',

  // Profile / settings
  SPORT_PREFERENCES:      '/sport-preferences',
  NOTIFICATION_INBOX:     '/notification-inbox',
  NOTIFICATIONS_SETTINGS: '/notifications-settings',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
