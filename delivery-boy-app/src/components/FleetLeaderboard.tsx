import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { ZenvyBadge } from './ZenvyBadge';

export interface LeaderboardUser {
  id: string;
  name: string;
  deliveries: number;
  earnings: number;
  rating: number;
}

interface FleetLeaderboardProps {
  users: LeaderboardUser[];
  currentUserId?: string;
}

export const FleetLeaderboard: React.FC<FleetLeaderboardProps> = ({
  users,
  currentUserId,
}) => {
  const sorted = [...users].sort((a, b) => b.deliveries - a.deliveries);
  const topThree = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Deck */}
      <View style={styles.headerDeck}>
        <ZenvyBadge label="FLEET MERIT" variant="gold" size="sm" />
        <Text style={styles.title}>CAMPUS DISPATCH CHAMPIONS</Text>
        <Text style={styles.subtitle}>
          Rankings reset every Monday at 00:00 IST. Top 3 riders earn weekly Zenvy bonuses.
        </Text>
      </View>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <View style={styles.podiumRow}>
          {topThree.map((user, idx) => {
            const rank = idx + 1;
            const isFirst = rank === 1;
            return (
              <View
                key={user.id || idx}
                style={[
                  styles.podiumCard,
                  isFirst && styles.podiumCardFirst,
                ]}
              >
                <LinearGradient
                  colors={
                    isFirst
                      ? ['rgba(212, 175, 122, 0.25)', '#141622']
                      : ['#1A1D28', '#10121A']
                  }
                  style={styles.podiumGradient}
                >
                  <View
                    style={[
                      styles.rankCircle,
                      isFirst ? styles.rankCircleFirst : styles.rankCircleOther,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankNumber,
                        isFirst ? styles.rankNumberFirst : styles.rankNumberOther,
                      ]}
                    >
                      {rank}
                    </Text>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.podiumRuns}>
                    {user.deliveries} Runs
                  </Text>
                  <Text style={styles.podiumEarn}>
                    ₹{user.earnings}
                  </Text>
                </LinearGradient>
              </View>
            );
          })}
        </View>
      )}

      {/* Full Leaderboard List */}
      <View style={styles.listContainer}>
        {rest.map((user, idx) => {
          const rank = idx + 4;
          const isCurrentUser = user.id === currentUserId;
          return (
            <View
              key={user.id || idx}
              style={[
                styles.listItem,
                isCurrentUser && styles.listItemCurrent,
              ]}
            >
              <View style={styles.listRankBox}>
                <Text style={styles.listRankText}>#{rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listUserName}>{user.name}</Text>
                <Text style={styles.listUserSub}>★ {Number(user.rating).toFixed(1)} Rating</Text>
              </View>
              <View style={styles.listMetrics}>
                <Text style={styles.listRuns}>{user.deliveries} Runs</Text>
                <Text style={styles.listEarn}>₹{user.earnings}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 80,
  },
  headerDeck: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    marginTop: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 290,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginVertical: SPACING.md,
  },
  podiumCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  podiumCardFirst: {
    borderColor: COLORS.goldBorder,
    transform: [{ scale: 1.05 }],
  },
  podiumGradient: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  rankCircleFirst: {
    backgroundColor: COLORS.gold,
  },
  rankCircleOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '900',
  },
  rankNumberFirst: {
    color: '#000000',
  },
  rankNumberOther: {
    color: '#FFFFFF',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  podiumRuns: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emeraldLight,
    marginTop: 2,
  },
  podiumEarn: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.goldLight,
    marginTop: 1,
  },
  listContainer: {
    backgroundColor: '#10121A',
    borderRadius: RADIUS.card,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 10,
  },
  listItemCurrent: {
    backgroundColor: 'rgba(212, 175, 122, 0.1)',
    borderRadius: RADIUS.sm,
    borderColor: COLORS.goldBorder,
    borderWidth: 1,
  },
  listRankBox: {
    width: 32,
    alignItems: 'center',
  },
  listRankText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  listUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listUserSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  listMetrics: {
    alignItems: 'flex-end',
  },
  listRuns: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.emeraldLight,
  },
  listEarn: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.goldLight,
    marginTop: 1,
  },
});
