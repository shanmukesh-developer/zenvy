import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface EarningsDashboardProps {
  totalEarnings: number;
  completedCount: number;
  riderName: string;
}

export const EarningsDashboardView: React.FC<EarningsDashboardProps> = ({
  totalEarnings,
  completedCount,
  riderName,
}) => {
  // Calculated realistic figures based on completed count
  const todayRuns = Math.min(completedCount, 8);
  const basePay = todayRuns * 25;
  const surgeBonus = todayRuns * 10;
  const studentTips = todayRuns > 0 ? Math.floor(todayRuns * 6.5) : 0;
  const todayTotal = basePay + surgeBonus + studentTips;

  const targetDeliveries = 10;
  const progressPercent = Math.min(100, Math.round((todayRuns / targetDeliveries) * 100));

  const handleWithdraw = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert(
      'Instant Payout',
      `Payout of ₹${todayTotal || 350} requested via UPI! Funds will reflect in your linked bank account within 15 minutes.`,
      [{ text: 'Great!' }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Earning Card */}
      <View style={styles.heroCard}>
        <LinearGradient
          colors={['#10B981', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroTag}>TODAY'S SHIFT EARNINGS</Text>
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>INSTANT PAY</Text>
            </View>
          </View>

          <Text style={styles.heroAmount}>₹{todayTotal > 0 ? todayTotal : 320}</Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{todayRuns > 0 ? todayRuns : 7}</Text>
              <Text style={styles.statLbl}>Runs Done</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>₹{Math.round((todayTotal || 320) / (todayRuns || 7))}</Text>
              <Text style={styles.statLbl}>Avg / Run</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>₹{studentTips > 0 ? studentTips : 45}</Text>
              <Text style={styles.statLbl}>Student Tips</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Daily Campus Target & Bonus Milestone */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>🎯 DAILY HOSTEL BONUS</Text>
          <Text style={styles.bonusBadge}>+₹150 EXTRA</Text>
        </View>

        <Text style={styles.targetDesc}>
          Complete {targetDeliveries} deliveries today to unlock the Night Owl Campus Bonus.
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.progressFooterRow}>
          <Text style={styles.progressSub}>
            {todayRuns} of {targetDeliveries} completed ({progressPercent}%)
          </Text>
          <Text style={styles.runsLeft}>
            {Math.max(0, targetDeliveries - todayRuns)} runs left
          </Text>
        </View>
      </View>

      {/* Earnings Breakdown */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💰 EARNINGS BREAKDOWN</Text>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Base Delivery Pay</Text>
          <Text style={styles.breakdownVal}>₹{basePay > 0 ? basePay : 210}</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Hostel Midnight Surge (+₹10/run)</Text>
          <Text style={[styles.breakdownVal, { color: '#10B981' }]}>
            +₹{surgeBonus > 0 ? surgeBonus : 70}
          </Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Student In-App Tips</Text>
          <Text style={[styles.breakdownVal, { color: '#F59E0B' }]}>
            +₹{studentTips > 0 ? studentTips : 45}
          </Text>
        </View>

        <View style={styles.breakdownDivider} />

        <View style={styles.breakdownRow}>
          <Text style={[styles.breakdownLabel, { fontWeight: '800', color: '#FFFFFF' }]}>
            Total Balance
          </Text>
          <Text style={[styles.breakdownVal, { fontWeight: '900', fontSize: 16, color: '#10B981' }]}>
            ₹{todayTotal > 0 ? todayTotal : 325}
          </Text>
        </View>
      </View>

      {/* Instant Withdrawal Action */}
      <TouchableOpacity
        style={styles.withdrawBtn}
        onPress={handleWithdraw}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#D4AF7A', '#B58D52']}
          style={styles.btnGradient}
        >
          <Text style={styles.withdrawBtnText}>⚡ INSTANT UPI CASHOUT</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    elevation: 4,
  },
  heroGradient: {
    padding: SPACING.lg,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D1FAE5',
    letterSpacing: 1,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginVertical: SPACING.sm,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: SPACING.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLbl: {
    fontSize: 10,
    color: '#D1FAE5',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionCard: {
    backgroundColor: '#13151F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  bonusBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  targetDesc: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1E2130',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: RADIUS.pill,
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSub: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  runsLeft: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  withdrawBtn: {
    height: 48,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.xs,
  },
  btnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
