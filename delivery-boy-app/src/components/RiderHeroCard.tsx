import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { ZenvyBadge } from './ZenvyBadge';

interface RiderHeroCardProps {
  riderName: string;
  vehicleNumber?: string;
  rating: number;
  totalEarnings: number;
  completedCount: number;
  isOnline: boolean;
  onToggleDuty: (val: boolean) => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export const RiderHeroCard: React.FC<RiderHeroCardProps> = ({
  riderName,
  vehicleNumber = 'AP-07-AB-1234',
  rating = 4.9,
  totalEarnings = 0,
  completedCount = 0,
  isOnline,
  onToggleDuty,
  onLogout,
  onOpenSettings,
}) => {
  const initial = riderName ? riderName.charAt(0).toUpperCase() : 'R';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#141622', '#10121A', '#0D0F15']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Top Header Row: Identity & Status */}
        <View style={styles.identityRow}>
          {/* Avatar with Status Ring */}
          <View
            style={[
              styles.avatarRing,
              isOnline ? styles.avatarRingOnline : styles.avatarRingOffline,
            ]}
          >
            <LinearGradient
              colors={isOnline ? ['#10B981', '#059669'] : ['#27272A', '#18181B']}
              style={styles.avatarInner}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
            {isOnline && <View style={styles.pulseDot} />}
          </View>

          {/* Rider Name & Fleet Metadata */}
          <View style={styles.riderDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.riderName} numberOfLines={1}>
                {riderName}
              </Text>
              <ZenvyBadge
                label="ELITE"
                variant="gold"
                size="sm"
                style={{ marginLeft: 6 }}
              />
            </View>

            <View style={styles.subInfoRow}>
              <View style={styles.vehicleChip}>
                <Text style={styles.vehicleText}>{vehicleNumber}</Text>
              </View>
              <View style={styles.scoreChip}>
                <Text style={styles.starText}>★</Text>
                <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
              </View>
            </View>
          </View>

          {/* Action Button: Sign Out */}
          <View style={styles.actionButtonsCol}>
            <TouchableOpacity
              style={[styles.iconButton, styles.logoutButton]}
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutSymbol}>⏻</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Duty Toggle Banner */}
        <View style={styles.dutyBanner}>
          <View style={styles.dutyStatusTextCol}>
            <View style={styles.dutyBeaconRow}>
              <View
                style={[
                  styles.beaconDot,
                  { backgroundColor: isOnline ? COLORS.emerald : '#6B7280' },
                ]}
              />
              <Text
                style={[
                  styles.dutyStatusTitle,
                  { color: isOnline ? COLORS.emeraldLight : COLORS.textMuted },
                ]}
              >
                {isOnline ? 'DISPATCH RADAR ACTIVE' : 'RADAR OFFLINE • STANDBY'}
              </Text>
            </View>
            <Text style={styles.dutySubtext}>
              {isOnline
                ? 'Campus dispatch is routing nearby orders to you'
                : 'Switch on duty to start receiving delivery requests'}
            </Text>
          </View>

          <View style={styles.switchWrapper}>
            <Switch
              value={isOnline}
              onValueChange={onToggleDuty}
              trackColor={{
                false: 'rgba(255, 255, 255, 0.12)',
                true: 'rgba(16, 185, 129, 0.45)',
              }}
              thumbColor={isOnline ? COLORS.emerald : '#94A3B8'}
            />
          </View>
        </View>

        {/* Fleet Performance Metrics Dock */}
        <View style={styles.metricsDock}>
          {/* Metric 1: Today's Earnings */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>EARNINGS</Text>
            <Text style={styles.metricValueGold}>₹{totalEarnings}</Text>
            <Text style={styles.metricSub}>Today</Text>
          </View>

          <View style={styles.metricDivider} />

          {/* Metric 2: Completed Orders */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>DELIVERED</Text>
            <Text style={styles.metricValueEmerald}>{completedCount}</Text>
            <Text style={styles.metricSub}>Runs</Text>
          </View>

          <View style={styles.metricDivider} />

          {/* Metric 3: Fleet Rating */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>RATING</Text>
            <Text style={styles.metricValueWhite}>
              {Number(rating).toFixed(1)}
            </Text>
            <Text style={styles.metricSub}>Campus</Text>
          </View>

          <View style={styles.metricDivider} />

          {/* Metric 4: On-Time Speed */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>SPEED</Text>
            <Text style={styles.metricValueGold}>99%</Text>
            <Text style={styles.metricSub}>On-Time</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.25)',
    ...SHADOWS.cardElevated,
  },
  cardGradient: {
    padding: SPACING.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarRingOnline: {
    borderWidth: 2,
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  avatarRingOffline: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pulseDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: COLORS.emerald,
    borderWidth: 2,
    borderColor: COLORS.bgDark,
  },
  riderDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  vehicleChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  vehicleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    gap: 3,
  },
  starText: {
    fontSize: 10,
    color: COLORS.gold,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldLight,
  },
  actionButtonsCol: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoutButton: {
    borderColor: 'rgba(239, 79, 95, 0.25)',
    backgroundColor: 'rgba(239, 79, 95, 0.08)',
  },
  iconSymbol: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  logoutSymbol: {
    fontSize: 15,
    color: COLORS.coral,
    fontWeight: '900',
  },
  dutyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  dutyStatusTextCol: {
    flex: 1,
  },
  dutyBeaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dutyStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dutySubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  switchWrapper: {
    marginLeft: SPACING.sm,
  },
  metricsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metricValueGold: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.goldLight,
    letterSpacing: -0.3,
  },
  metricValueEmerald: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.emeraldLight,
    letterSpacing: -0.3,
  },
  metricValueWhite: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  metricSub: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
});
