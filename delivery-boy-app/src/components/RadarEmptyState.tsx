import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { ZenvyBadge } from './ZenvyBadge';

interface RadarEmptyStateProps {
  type: 'active' | 'available';
  availableCount?: number;
  onSwitchToAvailable?: () => void;
  onRefresh?: () => void;
}

export const RadarEmptyState: React.FC<RadarEmptyStateProps> = ({
  type,
  availableCount = 0,
  onSwitchToAvailable,
  onRefresh,
}) => {
  return (
    <View style={styles.container}>
      {/* High-Tech Concentric Radar Rings */}
      <View style={styles.radarOuterRing}>
        <View style={styles.radarMiddleRing}>
          <View style={styles.radarInnerRing}>
            <LinearGradient
              colors={[COLORS.emerald, COLORS.emeraldDark]}
              style={styles.radarCenterCore}
            >
              <View style={styles.radarPing} />
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Status Chips */}
      <View style={styles.badgeRow}>
        <ZenvyBadge
          label="GPS LOCK 3M"
          variant="emerald"
          size="sm"
        />
        <ZenvyBadge
          label="SRM CAMPUS DISPATCH"
          variant="gold"
          size="sm"
        />
      </View>

      {/* Main Title & Subtitle */}
      <Text style={styles.title}>
        {type === 'active'
          ? 'NO ACTIVE DELIVERIES IN TRANSIT'
          : 'RADAR IS SCANNING FOR ORDERS'}
      </Text>

      <Text style={styles.subtitle}>
        {type === 'active'
          ? 'You have completed all active deliveries. Check the Radar feed to claim incoming campus orders.'
          : 'New campus orders appear here instantly. Auto-refresh is polling every 10 seconds.'}
      </Text>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {type === 'active' && onSwitchToAvailable && (
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={() => {
              Vibration.vibrate(30);
              onSwitchToAvailable();
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              <Text style={styles.primaryBtnText}>
                CHECK RADAR FEED {availableCount > 0 ? `(${availableCount})` : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshActionBtn}
            onPress={() => {
              Vibration.vibrate(20);
              onRefresh();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshBtnText}>SYNC DISPATCH NOW</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl + 10,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    ...SHADOWS.card,
  },
  radarOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: COLORS.emeraldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  radarMiddleRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarInnerRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  radarCenterCore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarPing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: SPACING.xl,
  },
  actionsRow: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionBtn: {
    width: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  btnGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.bgCard,
    letterSpacing: 0.8,
  },
  refreshActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.emeraldLight,
    letterSpacing: 0.8,
  },
});
