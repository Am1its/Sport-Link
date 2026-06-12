/**
 * Central API endpoint definitions.
 * Import from here instead of hard-coding strings throughout screens.
 *
 * Static keys → plain string constants.
 * Dynamic builders → functions that return the interpolated path.
 */

export const API = {
  // Auth
  AUTH_LOGIN:             '/api/auth/login',
  AUTH_REGISTER:          '/api/auth/register',
  AUTH_GOOGLE:            '/api/auth/google',

  // Users — static
  ME:                     '/api/users/me',
  USERS_PUSH_TOKEN:       '/api/users/push-token',
  USERS_SEARCH:           '/api/users/search',
  USERS_AVATARS:          '/api/users/avatars',
  USERS_LEADERBOARD:      '/api/users/leaderboard',
  USERS_SPORT_PREFS:      '/api/users/sport-preferences',
  USERS_SUGGESTIONS:      '/api/users/suggestions',
  USERS_BLOCKED:          '/api/users/blocked',

  // Games — static
  GAMES:                  '/api/games',
  MY_GAMES:               '/api/games/mine',

  // Chats
  CHATS:                  '/api/chats',

  // Friends — static
  FRIENDS:                '/api/friends',
  FRIEND_REQUESTS:        '/api/friends/requests',

  // DMs — static
  DM:                     '/api/dm',

  // Ratings — static
  RATINGS_BATCH:          '/api/ratings/batch',
  RATINGS_PEER:           '/api/ratings/peer',

  // Notifications — static
  NOTIFICATIONS:          '/api/notifications',
  NOTIFICATIONS_READ_ALL: '/api/notifications/read-all',

  // Courts — static
  COURTS_NEARBY:          '/api/courts/nearby',
  COURTS_PHOTO:           '/api/courts/photo',

  // Activity
  ACTIVITY:               '/api/activity',

  // --- Dynamic builders ---

  // Users
  user:                  (id: number | string) => `/api/users/${id}`,
  userBlock:             (id: number | string) => `/api/users/${id}/block`,
  userReport:            (id: number | string) => `/api/users/${id}/report`,

  // Games
  game:                  (id: number | string) => `/api/games/${id}`,
  gameJoin:              (id: number | string) => `/api/games/${id}/join`,
  gameLeave:             (id: number | string) => `/api/games/${id}/leave`,
  gameCheckin:           (id: number | string) => `/api/games/${id}/checkin`,
  gameBoost:             (id: number | string) => `/api/games/${id}/boost`,
  gameComplete:          (id: number | string) => `/api/games/${id}/complete`,
  gamePostPhoto:         (id: number | string) => `/api/games/${id}/post-photo`,
  gameParticipants:      (id: number | string) => `/api/games/${id}/participants`,

  // Chats
  chatMessages:          (gameId: number | string) => `/api/chats/${gameId}/messages`,

  // Friends
  friend:                (id: number | string) => `/api/friends/${id}`,
  friendAccept:          (id: number | string) => `/api/friends/${id}/accept`,

  // DMs
  dmConvo:               (userId: number | string) => `/api/dm/${userId}`,
  dmRead:                (userId: number | string) => `/api/dm/${userId}/read`,

  // Ratings
  gameRatings:           (gameId: number | string) => `/api/ratings/game/${gameId}`,
  gameRatingResults:     (gameId: number | string) => `/api/ratings/game/${gameId}/results`,

  // Notifications
  notificationRead:      (id: number | string) => `/api/notifications/${id}/read`,

  // Courts
  court:                 (placeId: string) => `/api/courts/${placeId}`,
  courtClaim:            (placeId: string) => `/api/courts/${placeId}/claim`,
  courtReviews:          (placeId: string) => `/api/courts/${placeId}/reviews`,
  courtReview:           (placeId: string, id: number | string) => `/api/courts/${placeId}/reviews/${id}`,
  courtReviewResponse:   (placeId: string, id: number | string) => `/api/courts/${placeId}/reviews/${id}/response`,
  courtAnnouncements:    (placeId: string) => `/api/courts/${placeId}/announcements`,
  courtAnnouncement:     (placeId: string, id: number | string) => `/api/courts/${placeId}/announcements/${id}`,
} as const;
