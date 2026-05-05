export const AVATAR_PALETTE = ['#FF8C00', '#4F9EFF', '#FF453A', '#FFD700', '#A78BFA', '#0FEA95', '#FF6B9D', '#34C759'];

export const getAvatarColor = (name: string): string =>
  AVATAR_PALETTE[(name.charCodeAt(0) + name.length) % AVATAR_PALETTE.length];
