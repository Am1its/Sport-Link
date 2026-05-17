// SportLink design tokens — single source of truth

export const Colors = {
  // Backgrounds
  bg:       '#1C1C1E',
  surface:  '#2C2C2E',
  surface2: '#3A3A3C',

  // Text hierarchy
  text:      '#FFFFFF',
  textSub:   '#AEAEB2',
  textMuted: '#636366',
  textHint:  '#48484A',

  // Borders
  border:    '#3A3A3C',
  borderSub: '#2C2C2E',

  // Brand accent — green
  accent:       '#0FEA95',
  accentFaint:  '#0FEA9515',
  accentBorder: '#0FEA9555',

  // Blue
  blue:       '#4F9EFF',
  blueFaint:  '#4F9EFF15',
  blueBorder: '#4F9EFF55',

  // Semantic states
  success:       '#0FEA95',
  successFaint:  '#0FEA9520',
  warning:       '#FF9F0A',
  warningFaint:  '#FF9F0A20',
  warningBorder: '#FF9F0A55',
  error:         '#FF453A',
  errorFaint:    '#FF453A20',
  errorBorder:   '#FF453A55',

  // Utility accents
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  purple:  '#A78BFA',
} as const;

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
} as const;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   18,
  xxl:  24,
  pill: 100,
} as const;

// Consistent type scale
export const Type = {
  screenTitle:  { fontSize: 28, fontWeight: '900' as const, letterSpacing: 0.3 },
  sectionLabel: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  cardSport:    { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  cardTitle:    { fontSize: 16, fontWeight: '800' as const, letterSpacing: 0.2 },
  meta:         { fontSize: 12, fontWeight: '500' as const },
  label:        { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  body:         { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  btnPrimary:   { fontSize: 15, fontWeight: '800' as const },
  btnSmall:     { fontSize: 13, fontWeight: '700' as const },
  stat:         { fontSize: 22, fontWeight: '900' as const },
  statLabel:    { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  name:         { fontSize: 26, fontWeight: '900' as const, letterSpacing: 0.3 },
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
