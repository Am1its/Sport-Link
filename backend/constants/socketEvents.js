/**
 * Socket.io event name constants.
 * Mirror of frontend/constants/events.ts — keep both in sync.
 */

const SOCKET_EVENTS = {
  // Game chat
  JOIN_GAME:    'join_game',
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE:  'new_message',
  GAME_TYPING:  'game_typing',

  // Direct messages
  NEW_DM:       'new_dm',
  DM_TYPING:    'dm_typing',
  DM_READ:      'dm_read',
};

module.exports = { SOCKET_EVENTS };
