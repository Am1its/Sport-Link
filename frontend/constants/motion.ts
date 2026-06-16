// SportLink motion constants — spring physics for animations

export const Springs = {
  snappy: { stiffness: 400, damping: 28 },   // tab icons, small press feedback
  bouncy: { stiffness: 280, damping: 18 },   // cards, buttons, entrances — main personality
  gentle: { stiffness: 160, damping: 22 },   // hero orbs, floating backgrounds
} as const;

export type SpringConfig = (typeof Springs)[keyof typeof Springs];
