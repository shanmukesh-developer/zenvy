/**
 * Zenvy Friends — dark luxury theme.
 * Built from CampusDarkColors + the campus night / secret palette, with one accent and gold reserved
 * for verified badges. Only used inside Campus Buddy > Friends (and the header / bottom nav while
 * the Friends tab is open).
 */
import { StyleSheet } from 'react-native';
import { CampusDarkColors, CampusColors, CampusLayout } from '../../../constants/campusTheme';

export const FriendsColors = {
  /** Screen background. */
  bg: '#0E0D12',
  /** Raised surface (cards, sheets). */
  card: '#18161F',
  /** Second-level surface (inputs, chips, pressed rows). */
  cardHi: '#221F2B',
  line: '#2C2836',
  lineSoft: '#211E29',
  ink: CampusDarkColors.ink, // #F4F1EA
  muted: '#A9A3B8',
  faint: '#6F6A7C',
  /** The one accent. */
  accent: CampusColors.lavender, // #C8B6FF
  accentInk: '#17122B',
  accentSoft: 'rgba(200,182,255,0.14)',
  /** Verified badges only. */
  gold: '#E5C07B',
  goldSoft: 'rgba(229,192,123,0.14)',
  danger: '#F08A7E',
  dangerSoft: 'rgba(240,138,126,0.12)',
  success: CampusDarkColors.successText,
  warn: CampusDarkColors.amberOnDark,
  overlay: 'rgba(5,4,8,0.7)',
  /** Anonymous identities. */
  mask: CampusDarkColors.nightFill,
};

export const FS = CampusLayout.spacing;
export const FR = CampusLayout.radius;

/** Type scale (mirrors campus `T`, recoloured for dark). */
export const FT = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800', color: FriendsColors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700', color: FriendsColors.ink },
  h3: { fontSize: 15, fontWeight: '700', color: FriendsColors.ink },
  body: { fontSize: 14, lineHeight: 20, color: FriendsColors.ink },
  muted: { fontSize: 13, lineHeight: 18, color: FriendsColors.muted },
  small: { fontSize: 12, color: FriendsColors.muted },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: FriendsColors.muted, textTransform: 'uppercase' },
});

export const fui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: FriendsColors.bg },
  card: {
    backgroundColor: FriendsColors.card,
    borderRadius: FR.card,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    overflow: 'hidden',
  },
  cardPad: {
    backgroundColor: FriendsColors.card,
    borderRadius: FR.card,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    padding: FS.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FS.md,
    paddingHorizontal: FS.lg,
    paddingVertical: FS.md,
    minHeight: CampusLayout.touchTargetMin + 8,
    borderBottomWidth: 1,
    borderBottomColor: FriendsColors.lineSoft,
  },
  input: {
    backgroundColor: FriendsColors.cardHi,
    borderRadius: FR.md,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    color: FriendsColors.ink,
    paddingHorizontal: FS.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: FR.pill,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    backgroundColor: FriendsColors.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pillActive: { backgroundColor: FriendsColors.accent, borderColor: FriendsColors.accent },
  pillText: { fontSize: 13, fontWeight: '700', color: FriendsColors.muted },
  pillTextActive: { color: FriendsColors.accentInk },
  primaryBtn: {
    minHeight: 48,
    borderRadius: FR.pill,
    backgroundColor: FriendsColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: FriendsColors.accentInk },
  ghostBtn: {
    minHeight: 44,
    borderRadius: FR.pill,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '700', color: FriendsColors.ink },
});

/** Header / bottom-nav colours for the dark tone (Campus hub chrome while Friends is open). */
export const FriendsChrome = {
  bg: FriendsColors.bg,
  surface: FriendsColors.card,
  line: FriendsColors.line,
  ink: FriendsColors.ink,
  muted: FriendsColors.muted,
  accent: FriendsColors.accent,
  accentSoft: FriendsColors.accentSoft,
  accentInk: FriendsColors.accentInk,
};
