import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Order } from '../types';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface HostelRouteOptimizerProps {
  activeOrders: Order[];
  onSelectOrder?: (orderId: string) => void;
}

export const HostelRouteOptimizer: React.FC<HostelRouteOptimizerProps> = ({
  activeOrders,
  onSelectOrder,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!activeOrders || activeOrders.length === 0) {
    return null;
  }

  // Group orders by hostel block
  const blockMap: Record<string, Order[]> = {};
  activeOrders.forEach((ord: any) => {
    const block = ord.user?.hostelBlock || ord.drop || ord.deliveryAddress?.split(',')[0] || 'Hostel Campus';
    if (!blockMap[block]) {
      blockMap[block] = [];
    }
    blockMap[block].push(ord);
  });

  const blockKeys = Object.keys(blockMap);
  const totalStops = blockKeys.length;
  const totalRuns = activeOrders.length;

  const toggleExpand = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const openNavigationForBlock = (blockName: string) => {
    const query = encodeURIComponent(`SRM University AP, ${blockName}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={['#161A29', '#0F121C']}
        style={styles.gradient}
      >
        {/* Header summary */}
        <TouchableOpacity
          style={styles.headerRow}
          onPress={toggleExpand}
          activeOpacity={0.8}
        >
          <View style={styles.iconBox}>
            <Text style={styles.icon}>🗺️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.liveTag}>
                <View style={styles.greenDot} />
                <Text style={styles.liveTagText}>SMART CAMPUS ROUTE</Text>
              </View>
              <Text style={styles.stopsBadge}>
                {totalStops} {totalStops === 1 ? 'BLOCK' : 'BLOCKS'} • {totalRuns} RUNS
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {totalStops === 1
                ? `Direct drop to ${blockKeys[0]}`
                : `Optimal Sequence: ${blockKeys.join(' ➔ ')}`}
            </Text>
          </View>
          <Text style={styles.expandChevron}>{expanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Detailed stop milestones */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <Text style={styles.sequenceHeader}>OPTIMIZED DELIVERY STOPS</Text>

            {blockKeys.map((block, idx) => {
              const ordersInBlock = blockMap[block];
              return (
                <View key={idx} style={styles.stopCard}>
                  <View style={styles.stopNumCircle}>
                    <Text style={styles.stopNumText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.blockTitleRow}>
                      <Text style={styles.blockName}>{block}</Text>
                      <TouchableOpacity
                        style={styles.navChip}
                        onPress={() => openNavigationForBlock(block)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.navChipText}>📍 GPS NAV</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.ordersSummary}>
                      {ordersInBlock.length} {ordersInBlock.length === 1 ? 'Student delivery' : 'Deliveries in this block'}:
                    </Text>

                    {/* Sub items / rooms */}
                    <View style={styles.roomsList}>
                      {ordersInBlock.map((ord: any, subIdx) => {
                        const room = ord.user?.roomNumber ? `Room ${ord.user.roomNumber}` : 'Hostel Gate';
                        const name = ord.user?.name || ord.customerName || 'Student';
                        return (
                          <TouchableOpacity
                            key={subIdx}
                            style={styles.roomItemRow}
                            onPress={() => onSelectOrder?.(ord.id.toString())}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.roomDot}>•</Text>
                            <Text style={styles.roomText}>
                              <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{room}</Text> ({name})
                            </Text>
                            <Text style={styles.orderIdTag}>#{ord.id.toString().slice(-4)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    elevation: 3,
  },
  gradient: {
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#60A5FA',
    letterSpacing: 0.5,
  },
  stopsBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  expandChevron: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingHorizontal: 4,
  },
  expandedContent: {
    marginTop: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: SPACING.sm,
  },
  sequenceHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  stopCard: {
    flexDirection: 'row',
    backgroundColor: '#1C2133',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: 8,
    gap: 10,
  },
  stopNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  navChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  navChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93C5FD',
  },
  ordersSummary: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 4,
  },
  roomsList: {
    gap: 3,
  },
  roomItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  roomDot: {
    color: '#60A5FA',
    fontSize: 12,
  },
  roomText: {
    fontSize: 11,
    color: '#D1D5DB',
    flex: 1,
  },
  orderIdTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#9CA3AF',
  },
});
