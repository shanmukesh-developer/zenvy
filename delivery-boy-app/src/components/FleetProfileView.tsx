import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Vibration,
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
  onUpdateProfile?: (data: Partial<RiderProfile>) => Promise<void>;
}

export const FleetProfileView: React.FC<FleetProfileViewProps> = ({
  profile,
  historyOrders,
  onLogout,
  onOpenSettings,
  onUpdateProfile,
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editVehicleNumber, setEditVehicleNumber] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditVehicleNumber(
        !profile.vehicleNumber || profile.vehicleNumber === 'Not Registered' || profile.vehicleNumber === 'AP-07-AB-1234'
          ? ''
          : profile.vehicleNumber
      );
      setEditVehicleType(
        !profile.vehicleType || profile.vehicleType === 'Not Registered'
          ? ''
          : profile.vehicleType
      );
      setEditEmergencyContact(
        !profile.emergencyContact || profile.emergencyContact === 'Not Registered'
          ? ''
          : profile.emergencyContact
      );
    }
  }, [profile]);

  const initial = profile?.name ? profile.name.charAt(0).toUpperCase() : 'V';
  const fleetId = profile?.id ? `ZNV-RD${profile.id.slice(-4).toUpperCase()}` : 'ZNV-RD9102';
  const isVehicleUnset =
    !profile?.vehicleNumber ||
    profile.vehicleNumber === 'Not Registered' ||
    profile.vehicleNumber === 'AP-07-AB-1234';

  const handleSave = async () => {
    if (!editVehicleNumber.trim()) {
      Alert.alert(
        'Vehicle Number Required',
        'Please enter your vehicle plate number (or Bicycle / Walk) for campus hostel gate clearance.'
      );
      return;
    }
    if (!onUpdateProfile) return;
    setIsSaving(true);
    try {
      await onUpdateProfile({
        name: editName.trim() || profile?.name,
        vehicleNumber: editVehicleNumber.trim().toUpperCase(),
        vehicleType: editVehicleType.trim() || 'Two-Wheeler',
        emergencyContact: editEmergencyContact.trim() || profile?.emergencyContact || '',
      });
      Vibration.vibrate(50);
      setIsEditOpen(false);
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not save profile details.');
    } finally {
      setIsSaving(false);
    }
  };

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
                {profile?.name || 'Zenvy Fleet Pilot'}
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
                ★ {Number(profile?.rating || 5.0).toFixed(1)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Fleet Verification Credentials */}
      <View style={styles.sectionBox}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>VEHICLE & COMPLIANCE</Text>
          <TouchableOpacity
            style={styles.editPillBtn}
            onPress={() => setIsEditOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.editPillText}>✎ EDIT DETAILS</Text>
          </TouchableOpacity>
        </View>

        {isVehicleUnset && (
          <TouchableOpacity
            style={styles.unregisteredBanner}
            onPress={() => setIsEditOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.unregisteredBannerIcon}>⚠️</Text>
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={styles.unregisteredBannerTitle}>Vehicle Not Registered</Text>
              <Text style={styles.unregisteredBannerSub}>
                Tap to register your vehicle plate & model for hostel gate security passes.
              </Text>
            </View>
            <Text style={styles.unregisteredBannerArrow}>➔</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vehicle Number</Text>
          <Text
            style={[
              styles.infoValue,
              isVehicleUnset && styles.infoValueMissing,
            ]}
          >
            {isVehicleUnset ? 'Tap to Register' : profile?.vehicleNumber}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vehicle Type</Text>
          <Text style={styles.infoValue}>
            {profile?.vehicleType && profile.vehicleType !== 'Not Registered'
              ? profile.vehicleType
              : 'Two-Wheeler'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registered Mobile</Text>
          <Text style={styles.infoValue}>{profile?.phone || 'Verified via SMS'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Campus Base</Text>
          <Text style={styles.infoValue}>SRM AP Main Gate</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Emergency Contact</Text>
          <Text style={styles.infoValue}>
            {profile?.emergencyContact && profile.emergencyContact !== 'Not Registered'
              ? profile.emergencyContact
              : '9391955674'}
          </Text>
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

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={isEditOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Rider Credentials</Text>
              <TouchableOpacity onPress={() => setIsEditOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>FULL NAME</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your Full Name"
              placeholderTextColor="#71717A"
            />

            <Text style={styles.inputLabel}>VEHICLE PLATE NUMBER</Text>
            <TextInput
              style={styles.textInput}
              value={editVehicleNumber}
              onChangeText={setEditVehicleNumber}
              placeholder="e.g. AP 07 AB 1234 or Bicycle"
              placeholderTextColor="#71717A"
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>VEHICLE TYPE</Text>
            <TextInput
              style={styles.textInput}
              value={editVehicleType}
              onChangeText={setEditVehicleType}
              placeholder="e.g. Electric Scooter / Activa / Bike"
              placeholderTextColor="#71717A"
            />

            <Text style={styles.inputLabel}>EMERGENCY CONTACT NUMBER</Text>
            <TextInput
              style={styles.textInput}
              value={editEmergencyContact}
              onChangeText={setEditEmergencyContact}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#71717A"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#D4AF7A', '#99733E']}
                style={styles.saveBtnGradient}
              >
                {isSaving ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.saveBtnText}>SAVE & UPDATE CREDENTIALS</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  fleetTierText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gold,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  barcodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  barcodeLines: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: -1,
  },
  barcodeText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  profileStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statColLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statColValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statColValueGold: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.gold,
  },
  statColValueEmerald: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.emeraldLight,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionBox: {
    backgroundColor: '#10121A',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },
  editPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(212, 175, 122, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.3)',
  },
  editPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  unregisteredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 122, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.4)',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  unregisteredBannerIcon: {
    fontSize: 18,
  },
  unregisteredBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gold,
  },
  unregisteredBannerSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  unregisteredBannerArrow: {
    fontSize: 14,
    color: COLORS.gold,
    marginLeft: 6,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  infoValueMissing: {
    color: COLORS.gold,
    fontStyle: 'italic',
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
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#11131A',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    color: COLORS.textMuted,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#08090C',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  saveBtn: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
});
