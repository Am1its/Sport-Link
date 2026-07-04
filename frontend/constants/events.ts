/**
 * Socket.io event name constants shared across all real-time features.
 * Mirror of backend/constants/socketEvents.js — keep both in sync.
 */

export const SOCKET_EVENTS = {
  // Game chat
  JOIN_GAME:    'join_game',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE:  'new_message',
  GAME_TYPING:  'game_typing',

  // Direct messages
  NEW_DM:       'new_dm',
  DM_TYPING:    'dm_typing',
  DM_READ:      'dm_read',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
