import type { useRouter } from 'expo-router';
import { ROUTES } from '../constants/routes';

// Shared by the cold-start/foreground push handlers in _layout.tsx and the
// notification inbox row tap — single source of truth for notification data -> screen.
export function navigateFromNotification(data: Record<string, any>, router: ReturnType<typeof useRouter>) {
  if (!data) return;
  if (data.gameId) {
    router.push({ pathname: ROUTES.GAME_DETAIL as any, params: { id: String(data.gameId) } });
  } else if (data.screen === 'friends') {
    router.push(ROUTES.FRIENDS as any);
  } else if (data.screen === 'games') {
    router.push(ROUTES.GAMES_TAB as any);
  } else if (data.screen === 'profile') {
    router.push(ROUTES.PROFILE_TAB as any);
  }
}
