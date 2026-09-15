import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Vibration,
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface TelemetryDockProps {
  coords: { lat: number; lng: number };
  isConnected: boolean;
  isBatteryLow: boolean;
  emergencyContact?: string;
}

export const TelemetryDock: React.FC<TelemetryDockProps> = ({
  coords,
  isConnected,
  isBatteryLow,
  emergencyContact = '+919876543210',
}) => {
  const handleSOS = () => {
    Vibration.vibrate([0, 100, 50, 100]);
    Alert.alert(
      '🚨 FLEET EMERGENCY SOS',
      `Trigger emergency call to Zenvy Dispatch Support (${emergencyContact}) and transmit your current coordinates (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CALL DISPATCH',
          style: 'destructive',
          onPress: () => {
            Linking.openURL(`tel:${emergencyContact}`).catch(() => {
              Alert.alert('Error', 'Unable to initiate phone call');
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* GPS Telemetry Pill */}
      <View style={styles.telemetryGroup}>
        <View style={styles.liveIndicator} />
        <View>
          <Text style={styles.telemetryLabel}>CAMPUS GPS</Text>
          <Text style={styles.telemetryValue}>
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        </View>
      </View>

      {/* Network & Battery Status */}
      <View style={styles.telemetryGroup}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isConnected ? COLORS.emerald : COLORS.coral },
          ]}
        />
        <View>
          <Text style={styles.telemetryLabel}>LINK</Text>
          <Text style={styles.telemetryValue}>
            {isConnected ? 'ONLINE 5G' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {isBatteryLow && (
        <View style={styles.telemetryGroup}>
          <Text style={styles.batteryWarning}>⚡ LOW BATT</Text>
        </View>
      )}

      {/* SOS Safety Button */}
      <TouchableOpacity
        style={styles.sosButton}
        onPress={handleSOS}
        activeOpacity={0.8}
      >
        <Text style={styles.sosText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'rgba(10, 12, 17, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  telemetryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.emerald,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  telemetryLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  telemetryValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  batteryWarning: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.amber,
  },
  sosButton: {
    backgroundColor: 'rgba(239, 79, 95, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 79, 95, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  sosText: {
    color: COLORS.coral,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
