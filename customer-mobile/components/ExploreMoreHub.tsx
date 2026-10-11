import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SHADOWS } from '../constants/theme';

interface ExploreMoreHubProps {
  onPressOffers: () => void;
  onPressLateNight: () => void;
  onPressCollections: () => void;
  onPressRewards: () => void;
}

export default function ExploreMoreHub({
  onPressOffers,
  onPressLateNight,
  onPressCollections,
  onPressRewards,
}: ExploreMoreHubProps) {
  const { isDark } = useTheme();

  const cards = [
    {
      id: 'offers',
      title: 'Offers',
      subtitle: 'Flat ₹100 OFF',
      emoji: '🏷️',
      gradient: isDark ? ['#1E1B4B', '#0F172A'] : ['#EFF6FF', '#DBEAFE'],
      accent: '#3B82F6',
      badge: 'HOT',
      onPress: onPressOffers,
    },
    {
      id: 'latenight',
      title: 'Late Night',
      subtitle: 'Open till 3 AM',
      emoji: '🌙',
      gradient: isDark ? ['#311042', '#0F172A'] : ['#FAF5FF', '#F3E8FF'],
      accent: '#A855F7',
      badge: 'LIVE',
      onPress: onPressLateNight,
    },
    {
      id: 'collections',
      title: 'Campus Best',
      subtitle: 'Top Rated',
      emoji: '🍱',
      gradient: isDark ? ['#3F1D0B', '#0F172A'] : ['#FFF7ED', '#FFEDD5'],
      accent: '#F97316',
      badge: 'TOP',
      onPress: onPressCollections,
    },
    {
      id: 'rewards',
      title: 'Win Cash',
      subtitle: 'Up to ₹150',
      emoji: '🎁',
      gradient: isDark ? ['#064E3B', '#0F172A'] : ['#ECFDF5', '#D1FAE5'],
      accent: '#10B981',
      badge: 'FREE',
      onPress: onPressRewards,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionHeading, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          EXPLORE MORE
        </Text>
      </View>

      <View style={styles.gridRow}>
        {cards.map((c) => (
          <TouchableOpacity
            key={c.id}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              c.onPress();
            }}
            style={styles.cardWrapper}
          >
            <LinearGradient
              colors={c.gradient as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              {/* Mini Badge */}
              <View style={[styles.miniBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.miniBadgeText}>{c.badge}</Text>
              </View>

              {/* 3D miniature emoji / icon */}
              <View style={styles.iconCircle}>
                <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
              </View>

              {/* Card Texts */}
              <Text
                style={[
                  styles.cardTitle,
                  { color: isDark ? '#FFFFFF' : '#1E293B' },
                ]}
                numberOfLines={1}
              >
                {c.title}
              </Text>
              <Text style={[styles.cardSubtitle, { color: c.accent }]} numberOfLines={1}>
                {c.subtitle}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  headerRow: {
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
    ...SHADOWS.card,
    elevation: 3,
  },
  miniBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  miniBadgeText: {
    color: '#FFF',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 8.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
});
