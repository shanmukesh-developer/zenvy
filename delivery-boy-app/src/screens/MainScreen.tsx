// Logged-in shell: offline banner, 4 tabs, full-screen delivery flow and overlays.
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { color, space, type } from '../theme/tokens';
import { BottomTabBar } from '../components/ui/BottomTabBar';
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { Sheet } from '../components/ui/Sheet';
import { OfflineBanner } from '../components/rider/OfflineBanner';
import { useRider } from '../state/RiderProvider';
import { HomeScreen } from './HomeScreen';
import { OrdersScreen } from './OrdersScreen';
import { EarningsScreen } from './EarningsScreen';
import { ProfileScreen } from './ProfileScreen';
import { AvailableOrdersScreen } from './AvailableOrdersScreen';
import { ActiveDeliveryScreen } from './ActiveDeliveryScreen';
import { SupportScreen } from './SupportScreen';

export function MainScreen() {
  const r = useRider();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (r.overlay) {
        r.setOverlay(null);
        return true;
      }
      if (r.deliveryId) {
        r.closeDelivery();
        return true;
      }
      if (r.tab !== 'home') {
        r.setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [r]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <OfflineBanner connected={r.connected} serverReachable={r.serverReachable} queueCount={r.queueCount} onRetry={r.flushNow} />
      <View style={{ flex: 1 }}>
        {r.tab === 'home' ? <HomeScreen /> : null}
        {r.tab === 'orders' ? <OrdersScreen /> : null}
        {r.tab === 'earnings' ? <EarningsScreen /> : null}
        {r.tab === 'profile' ? <ProfileScreen /> : null}

        {r.deliveryId ? (
          <View style={StyleSheet.absoluteFill}>
            <ActiveDeliveryScreen key={r.deliveryId} orderId={r.deliveryId} onClose={r.closeDelivery} />
          </View>
        ) : null}
        {r.overlay?.kind === 'available' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.bg }]}>
            <AvailableOrdersScreen onBack={() => r.setOverlay(null)} />
          </View>
        ) : null}
        {r.overlay?.kind === 'support' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.bg }]}>
            <SupportScreen prefill={r.overlay.prefill} onBack={() => r.setOverlay(null)} />
          </View>
        ) : null}
      </View>
      {!r.deliveryId && !r.overlay ? (
        <BottomTabBar tab={r.tab} onChange={r.setTab} homeBadge={r.active.data.length || undefined} />
      ) : null}

      {/* Cancelled while the rider held it: blocking until acknowledged. */}
      <Sheet visible={!!r.cancelNotice} onClose={r.clearCancelNotice} blocking>
        {r.cancelNotice ? (
          <View style={{ gap: space.md, alignItems: 'center' }}>
            <View style={styles.cancelIcon}>
              <MaterialCommunityIcons name="cancel" size={40} color={color.danger} />
            </View>
            <Text style={[type.title2, { color: color.text, textAlign: 'center' }]}>Order #{r.cancelNotice.shortId} was cancelled</Text>
            <Text style={[type.body, { color: color.textSecondary, textAlign: 'center' }]}>
              Don't pick it up. If you already have the food, return it to {r.cancelNotice.restaurantName ?? 'the store'} as instructed by support.
            </Text>
            <View style={{ alignSelf: 'stretch', gap: space.sm }}>
              <PrimaryButton title="OK, got it" onPress={r.clearCancelNotice} />
              <SecondaryButton
                title="Contact support"
                icon="lifebuoy"
                onPress={() => {
                  const id = r.cancelNotice?.shortId;
                  r.clearCancelNotice();
                  r.setOverlay({ kind: 'support', prefill: `Order #${id}: order was cancelled while I had it. ` });
                }}
              />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  cancelIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: color.dangerTint, alignItems: 'center', justifyContent: 'center' },
});
