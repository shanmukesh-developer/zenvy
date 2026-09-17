import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Vibration,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface HandoverPinModalProps {
  visible: boolean;
  orderId: string;
  customerName: string;
  customerPhone?: string;
  hostelBlock: string;
  roomNumber?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const HandoverPinModal: React.FC<HandoverPinModalProps> = ({
  visible,
  orderId,
  customerName,
  customerPhone,
  hostelBlock,
  roomNumber,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDigitChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(cleaned);
    setErrorMsg('');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleConfirm = () => {
    if (pin.length < 4) {
      setErrorMsg('Please enter the 4-digit student delivery PIN');
      Vibration.vibrate([0, 50, 50, 50]);
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onConfirm(pin);
  };

  const handleBypass = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Bypass verification with standard tag
    onConfirm('VERIFIED_IN_PERSON');
  };

  const callCustomer = () => {
    if (customerPhone) {
      Linking.openURL(`tel:${customerPhone}`);
    }
  };

  const whatsappCustomer = () => {
    if (customerPhone) {
      const cleanNum = customerPhone.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${cleanNum}?text=Hello%20${encodeURIComponent(customerName)},%20your%20Zenvy%20order%20has%20arrived%20at%20${encodeURIComponent(hostelBlock)}!`);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>🔐</Text>
            </View>
            <Text style={styles.title}>Confirm Handover</Text>
            <Text style={styles.subtitle}>
              Ask {customerName} for their 4-digit delivery PIN to complete delivery
            </Text>
          </View>

          {/* Location Badge */}
          <View style={styles.locationBadge}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>
              {hostelBlock} {roomNumber ? `• Room ${roomNumber}` : ''}
            </Text>
          </View>

          {/* Quick Contact Buttons */}
          {customerPhone ? (
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={[styles.contactBtn, styles.callBtn]}
                onPress={callCustomer}
                activeOpacity={0.8}
              >
                <Text style={styles.contactBtnText}>📞 Call Student</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactBtn, styles.waBtn]}
                onPress={whatsappCustomer}
                activeOpacity={0.8}
              >
                <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* PIN Input Boxes */}
          <View style={styles.pinContainer}>
            {[0, 1, 2, 3].map((idx) => {
              const digit = pin[idx] || '';
              return (
                <View
                  key={idx}
                  style={[
                    styles.pinBox,
                    digit ? styles.pinBoxFilled : null,
                    errorMsg ? styles.pinBoxError : null,
                  ]}
                >
                  <Text style={styles.pinText}>{digit ? '•' : ''}</Text>
                </View>
              );
            })}
          </View>

          <TextInput
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={4}
            value={pin}
            onChangeText={handleDigitChange}
            autoFocus
            caretHidden
          />

          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.btnGradient}
              >
                <Text style={styles.confirmBtnText}>
                  {isLoading ? 'VERIFYING...' : '✓ VERIFY & COMPLETE'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bypassBtn}
              onPress={handleBypass}
              activeOpacity={0.7}
            >
              <Text style={styles.bypassBtnText}>
                Handed Over in Person (Bypass PIN)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Back to Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#13151F',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: SPACING.xl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.sm,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 122, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 122, 0.3)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    marginVertical: SPACING.sm,
    gap: 6,
  },
  locationIcon: {
    fontSize: 12,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4AF7A',
  },
  contactRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
    width: '100%',
  },
  contactBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  waBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  contactBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: SPACING.md,
  },
  pinBox: {
    width: 48,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: '#1E2130',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBoxFilled: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  pinBoxError: {
    borderColor: '#EF4444',
  },
  pinText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10B981',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginBottom: SPACING.sm,
  },
  actionCol: {
    width: '100%',
    gap: 8,
    marginTop: SPACING.sm,
  },
  confirmBtn: {
    width: '100%',
    height: 46,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bypassBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  bypassBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
});
