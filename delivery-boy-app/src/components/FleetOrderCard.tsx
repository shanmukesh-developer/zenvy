import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Linking,
  Alert,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { ZenvyBadge } from './ZenvyBadge';
import { Order, OrderItem } from '../types';

interface FleetOrderCardProps {
  order: Order;
  isAvailableFeed?: boolean;
  onAcceptOrder?: (orderId: string) => void;
  onUpdateStatus?: (orderId: string, status: string) => void;
  onNotifyGateArrival?: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
  onUploadItemPhoto?: (orderId: string) => void;
  onUploadBillProof?: (orderId: string) => void;
  isActionLoading?: boolean;
  pinInput: string;
  onPinChange: (val: string) => void;
  billAmountInput: string;
  onBillAmountChange: (val: string) => void;
}

export const FleetOrderCard: React.FC<FleetOrderCardProps> = ({
  order,
  isAvailableFeed = false,
  onAcceptOrder,
  onUpdateStatus,
  onNotifyGateArrival,
  onCancelOrder,
  onUploadItemPhoto,
  onUploadBillProof,
  isActionLoading = false,
  pinInput,
  onPinChange,
  billAmountInput,
  onBillAmountChange,
}) => {
  const [expanded, setExpanded] = useState<boolean>(!isAvailableFeed);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const ordAny = order as any;
  const orderIdShort = String(order.id).slice(-6).toUpperCase();
  const customerName = ordAny.user?.name || ordAny.customerName || 'Campus Student';
  const customerPhone = ordAny.user?.phone || ordAny.customerPhone || '';
  const hostelBlock = ordAny.user?.hostelBlock || ordAny.drop || ordAny.deliveryAddress?.split(',')[0] || 'Hostel Campus';
  const roomNumber = ordAny.user?.roomNumber || '';
  const fullDropLocation = `${hostelBlock}${roomNumber ? `, Room ${roomNumber}` : ''}`;
  const storeName = typeof ordAny.restaurant === 'string' ? ordAny.restaurant : (ordAny.restaurant?.name || ordAny.vendorName || (ordAny.isMegaBasket ? 'Campus Kirana Store' : 'Campus Kitchen'));
  const itemsCount = order.items?.length || 0;
  const estimatedEarning = ordAny.riderEarning || ordAny.deliveryFee || 35;

  const toggleCheckItem = (idx: number) => {
    Vibration.vibrate(15);
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const callCustomer = () => {
    if (!customerPhone) {
      Alert.alert('Info', 'Customer phone number not available');
      return;
    }
    Linking.openURL(`tel:${customerPhone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call');
    });
  };

  const openNavigation = () => {
    const query = encodeURIComponent(`SRM University AP, ${fullDropLocation}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {
      Alert.alert('Error', 'Unable to open maps');
    });
  };

  // Status mapping
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Accepted':
      case 'PartnerAssigned':
        return 'gold';
      case 'Picking':
      case 'Shopping':
        return 'blue';
      case 'PickedUp':
      case 'InTransit':
      case 'Delivering':
        return 'emerald';
      case 'ArrivedAtGate':
        return 'coral';
      default:
        return 'neutral';
    }
  };

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={['#13151F', '#0E1017']}
        style={styles.cardGradient}
      >
        {/* Card Header */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.headerLeft}>
            <View style={styles.orderIdChip}>
              <Text style={styles.orderIdHash}>#</Text>
              <Text style={styles.orderIdText}>{orderIdShort}</Text>
            </View>
            {order.isMegaBasket && (
              <ZenvyBadge label="KIRANA" variant="gold" size="sm" />
            )}
            <ZenvyBadge
              label={order.status || 'NEW'}
              variant={getStatusBadgeVariant(order.status)}
              size="sm"
            />
          </View>

          <View style={styles.earningBadge}>
            <Text style={styles.earningLabel}>PAYOUT</Text>
            <Text style={styles.earningValue}>+₹{estimatedEarning}</Text>
          </View>
        </View>

        {/* Waypoints: Pickup -> Drop */}
        <View style={styles.routeContainer}>
          {/* Pickup Waypoint */}
          <View style={styles.waypointRow}>
            <View style={styles.pickupDot} />
            <View style={styles.waypointTextCol}>
              <Text style={styles.waypointType}>PICKUP STORE</Text>
              <Text style={styles.waypointMain} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          </View>

          {/* Route Connecting Line */}
          <View style={styles.routeLine} />

          {/* Drop Waypoint */}
          <View style={styles.waypointRow}>
            <View style={styles.dropDot} />
            <View style={styles.waypointTextCol}>
              <Text style={styles.waypointType}>DROP LOCATION</Text>
              <Text style={styles.waypointMain} numberOfLines={1}>
                {fullDropLocation}
              </Text>
              <Text style={styles.waypointSub}>
                {customerName} {customerPhone ? `• ${customerPhone}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Pills Row: Call & Directions */}
        {!isAvailableFeed && (
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactChip}
              onPress={callCustomer}
              activeOpacity={0.7}
            >
              <Text style={styles.contactIcon}>📞</Text>
              <Text style={styles.contactText}>CALL STUDENT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactChip}
              onPress={openNavigation}
              activeOpacity={0.7}
            >
              <Text style={styles.contactIcon}>📍</Text>
              <Text style={styles.contactText}>NAVIGATE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactChip, { flex: 0.8 }]}
              onPress={() => setExpanded(!expanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.contactText}>
                {expanded ? '▲ HIDE ITEMS' : `▼ ${itemsCount} ITEMS`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expandable Item Manifest */}
        {expanded && order.items && order.items.length > 0 && (
          <View style={styles.manifestBox}>
            <Text style={styles.manifestTitle}>ITEM CHECKLIST</Text>
            {order.items.map((item: OrderItem, idx: number) => {
              const isChecked = !!checkedItems[idx];
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.checkItemRow}
                  onPress={() => toggleCheckItem(idx)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkBox,
                      isChecked && styles.checkBoxChecked,
                    ]}
                  >
                    {isChecked && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.itemName,
                      isChecked && styles.itemNameChecked,
                    ]}
                    numberOfLines={1}
                  >
                    {item.quantity}x {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ₹{(item.price || 0) * (item.quantity || 1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Gate Arrival Notification Action */}
        {!isAvailableFeed && order.status === 'PickedUp' && onNotifyGateArrival && (
          <TouchableOpacity
            style={styles.gateArrivalBtn}
            onPress={() => onNotifyGateArrival(order.id.toString())}
            activeOpacity={0.8}
            disabled={isActionLoading}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.btnGradient}
            >
              <Text style={styles.gateArrivalBtnText}>
                🔔 RING HOSTEL GATE BELL FOR CUSTOMER
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Mega Basket: Kirana Photo & Bill Approval Proof Cards */}
        {!isAvailableFeed && order.isMegaBasket && (
          <View style={styles.kiranaCard}>
            <Text style={styles.kiranaHeader}>KIRANA REIMBURSEMENT INSTRUCTIONS</Text>
            
            {/* Step 1: Item Photo */}
            <View style={styles.kiranaStepRow}>
              <View style={styles.stepNumPill}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Item Estimate Photo</Text>
                <Text style={styles.stepSub}>
                  {order.isPurchasingApprovedByCustomer
                    ? '✓ Customer approved purchasing'
                    : 'Awaiting customer purchase agreement'}
                </Text>
              </View>
              {onUploadItemPhoto && (
                <TouchableOpacity
                  style={styles.kiranaUploadBtn}
                  onPress={() => onUploadItemPhoto(order.id.toString())}
                >
                  <Text style={styles.kiranaUploadBtnText}>📷 UPLOAD</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Step 2: Store Bill Receipt */}
            <View style={styles.kiranaStepRow}>
              <View style={styles.stepNumPill}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Final Store Bill</Text>
                <TextInput
                  style={styles.billInput}
                  placeholder="Bill Amount (₹)"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  value={billAmountInput}
                  onChangeText={onBillAmountChange}
                />
              </View>
              {onUploadBillProof && (
                <TouchableOpacity
                  style={styles.kiranaUploadBtn}
                  onPress={() => onUploadBillProof(order.id.toString())}
                >
                  <Text style={styles.kiranaUploadBtnText}>RECEIPT</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 4-Digit Delivery PIN Verification Box */}
        {!isAvailableFeed && (order.status === 'ArrivedAtGate' || order.status === 'PickedUp') && (
          <View style={styles.pinVerificationBox}>
            <Text style={styles.pinBoxTitle}>ENTER 4-DIGIT DELIVERY PIN</Text>
            <Text style={styles.pinBoxSub}>
              Ask {customerName} for their secret completion PIN
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={onPinChange}
              placeholder="••••"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        )}

        {/* Primary Lifecycle Action Buttons */}
        <View style={styles.actionFooterRow}>
          {isAvailableFeed && onAcceptOrder && (
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => onAcceptOrder(order.id.toString())}
              disabled={isActionLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {isActionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>
                    ⚡ ACCEPT RUN (+₹{estimatedEarning})
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {!isAvailableFeed && onUpdateStatus && (
            <View style={styles.activeActionsCol}>
              {(order.status === 'Accepted' || order.status === 'Preparing' || order.status === 'ReadyForPickup') && (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={() => onUpdateStatus(order.id.toString(), 'Picking')}
                  disabled={isActionLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#D4AF7A', '#B58D52']}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.primaryActionBtnTextDark}>
                      ARRIVED AT STORE / START PICKING
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {order.status === 'Picking' && (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={() => onUpdateStatus(order.id.toString(), 'PickedUp')}
                  disabled={isActionLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      ✓ ITEMS PACKED • START DELIVERY RUN
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {order.status === 'PickedUp' && onNotifyGateArrival && (
                <TouchableOpacity
                  style={[styles.primaryActionButton, { marginBottom: 10 }]}
                  onPress={() => onNotifyGateArrival(order.id.toString())}
                  disabled={isActionLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      🔔 I HAVE ARRIVED AT HOSTEL GATE
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {(order.status === 'PickedUp' || order.status === 'ArrivedAtGate') && (
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={() => onUpdateStatus(order.id.toString(), 'Delivered')}
                  disabled={isActionLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#10B981', '#047857']}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      VERIFY PIN & COMPLETE RUN (+₹{estimatedEarning})
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Emergency Unassign Option */}
              {onCancelOrder && (
                <TouchableOpacity
                  style={styles.unassignButton}
                  onPress={() => onCancelOrder(order.id.toString())}
                  activeOpacity={0.7}
                >
                  <Text style={styles.unassignButtonText}>
                    EMERGENCY UNASSIGN ORDER
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...SHADOWS.card,
  },
  cardGradient: {
    padding: SPACING.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  orderIdHash: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  orderIdText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  earningBadge: {
    alignItems: 'flex-end',
  },
  earningLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  earningValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.emeraldLight,
    letterSpacing: -0.3,
  },
  routeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.emerald,
    marginTop: 3,
    marginRight: SPACING.sm + 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dropDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
    marginTop: 3,
    marginRight: SPACING.sm + 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  routeLine: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: 4,
    marginVertical: 2,
  },
  waypointTextCol: {
    flex: 1,
  },
  waypointType: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  waypointMain: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  waypointSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  contactChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.xs,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  contactIcon: {
    fontSize: 12,
  },
  contactText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  manifestBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  manifestTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  checkBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxChecked: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  checkMark: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldLight,
  },
  gateArrivalBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  gateArrivalBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  kiranaCard: {
    backgroundColor: 'rgba(212, 175, 122, 0.06)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  kiranaHeader: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.goldLight,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  kiranaStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stepNumPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepSub: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  billInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 4,
  },
  kiranaUploadBtn: {
    backgroundColor: 'rgba(212, 175, 122, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  kiranaUploadBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldLight,
  },
  pinVerificationBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    alignItems: 'center',
  },
  pinBoxTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.emeraldLight,
    letterSpacing: 0.8,
  },
  pinBoxSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  pinInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1.5,
    borderColor: COLORS.emerald,
    borderRadius: RADIUS.sm,
    width: 140,
    height: 44,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  actionFooterRow: {
    marginTop: SPACING.xs,
  },
  primaryActionButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.cardElevated,
  },
  btnGradient: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  primaryActionBtnTextDark: {
    fontSize: 12,
    fontWeight: '900',
    color: '#13151D',
    letterSpacing: 0.8,
  },
  activeActionsCol: {
    gap: 8,
  },
  unassignButton: {
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unassignButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.coral,
    letterSpacing: 0.8,
  },
});
