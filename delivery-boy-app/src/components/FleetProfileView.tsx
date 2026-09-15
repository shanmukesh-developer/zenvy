import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { ZenvyBadge } from './ZenvyBadge';
import { Order } from '../types';

interface RiderProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  totalEarnings: number;
  completedCount: number;
  vehicleNumber?: string;
  vehicleType?: string;
  zenPoints?: number;
  emergencyContact?: string;
}

interface FleetProfileViewProps {
  profile: RiderProfile | null;
  historyOrders: Order[];
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export const FleetProfileView: React.FC<FleetProfileViewProps> = ({
  profile,
  historyOrders,
  onLogout,
  onOpenSettings,
}) => {
  const initial = profile?.name ? profile.name.charAt(0).toUpperCase() : 'V';
  const fleetId = profile?.id ? `ZNV-RD${profile.id.slice(-4).toUpperCase()}` : 'ZNV-RD9102';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Elite Rider ID Card */}
      <View style={styles.idCard}>
        <LinearGradient
          colors={['#161824', '#10121A', '#0D0E14']}
          style={styles.idCardGradient}
        >
          {/* Avatar & Member Tag */}
          <View style={styles.avatarRow}>
            <View style={styles.avatarBorder}>
              <LinearGradient
                colors={['#D4AF7A', '#99733E']}
                style={styles.avatarFill}
              >
                <Text style={styles.avatarInitial}>{initial}</Text>
              </LinearGradient>
            </View>

            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.riderFullName}>
                {profile?.name || 'Vikram Singh'}
              </Text>
              <Text style={styles.fleetTierText}>
                SRM FLEET PILOT • SINCE 2026
              </Text>
              <View style={styles.barcodeChip}>
                <Text style={styles.barcodeLines}>||||||||| </Text>
                <Text style={styles.barcodeText}>{fleetId}</Text>
              </View>
            </View>
          </View>

          {/* Performance 3-Column Bar */}
          <View style={styles.profileStatsBar}>
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>TOTAL RUNS</Text>
              <Text style={styles.statColValue}>{profile?.completedCount || 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>TOTAL EARNED</Text>
              <Text style={styles.statColValueGold}>₹{profile?.totalEarnings || 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>FLEET SCORE</Text>
              <Text style={styles.statColValueEmerald}>
                ★ {Number(profile?.rating || 4.9).toFixed(1)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Fleet Verification Credentials */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionHeader}>VEHICLE & COMPLIANCE</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vehicle Number</Text>
          <Text style={styles.infoValue}>{profile?.vehicleNumber || 'AP-07-AB-1234'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registered Mobile</Text>
          <Text style={styles.infoValue}>{profile?.phone || '+91 87654 32100'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Campus Base</Text>
          <Text style={styles.infoValue}>SRM AP Main Gate</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Emergency Contact</Text>
          <Text style={styles.infoValue}>{profile?.emergencyContact || '+91 98765 43210'}</Text>
        </View>
      </View>

      {/* Recent Fulfillment History */}
      <View style={styles.sectionBox}>
        <View style={styles.historyHeaderRow}>
          <Text style={styles.sectionHeader}>RECENT COMPLETED RUNS</Text>
          <ZenvyBadge
            label={`${historyOrders.length} DELIVERED`}
            variant="emerald"
            size="sm"
          />
        </View>

        {historyOrders.length === 0 ? (
          <Text style={styles.emptyHistoryText}>
            No completed deliveries recorded today yet.
          </Text>
        ) : (
          historyOrders.slice(0, 10).map((ord) => {
            const ordShort = String(ord.id).slice(-6).toUpperCase();
            return (
              <View key={ord.id} style={styles.historyItemRow}>
                <View>
                  <Text style={styles.historyOrdId}>#{ordShort}</Text>
                  <Text style={styles.historyCustomer}>
                    {ord.user?.name || ord.customerName || 'Campus Student'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.historyEarning}>
                    +₹{ord.riderEarning || ord.deliveryFee || 35}
                  </Text>
                  <ZenvyBadge label="DELIVERED" variant="emerald" size="sm" />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Logout Action Button */}
      <View style={styles.buttonGroup}>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutBtnText}>LOG OUT OF FLEET DUTY</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 90,
  },
  idCard: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.3)',
    marginVertical: SPACING.md,
    ...SHADOWS.cardElevated,
  },
  idCardGradient: {
    padding: SPACING.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarBorder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.gold,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFill: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
  },
  riderFullName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  fleetTierText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  barcodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  barcodeLines: {
    fontSize: 9,
    color: COLORS.goldLight,
    letterSpacing: -1,
  },
  barcodeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  profileStatsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statColLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  statColValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statColValueGold: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.goldLight,
    marginTop: 2,
  },
  statColValueEmerald: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.emeraldLight,
    marginTop: 2,
  },
  sectionBox: {
    backgroundColor: '#11131C',
    borderRadius: RADIUS.card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.goldLight,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyHistoryText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: SPACING.sm,
  },
  historyItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  historyOrdId: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  historyCustomer: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyEarning: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.emeraldLight,
    marginBottom: 2,
  },
  buttonGroup: {
    gap: 10,
    marginTop: SPACING.sm,
  },
  secondaryOutlineBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  secondaryOutlineText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  logoutBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 79, 95, 0.4)',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 79, 95, 0.08)',
  },
  logoutBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1,
  },
});
