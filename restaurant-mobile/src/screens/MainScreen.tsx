// Logged-in shell: sticky store header + connection banner, the current tab, bottom nav, and the
// full-screen new-order alert on top of everything.
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomNav, MainTab } from '../components/Nav';
import { NewOrderAlert } from '../components/NewOrderAlert';
import { ConnectionBanner, StoreHeader } from '../components/StoreHeader';
import { useStore } from '../state/StoreProvider';
import { color } from '../theme/tokens';
import type { Order } from '../types';
import MenuScreen from './MenuScreen';
import MoreScreen from './MoreScreen';
import OrdersScreen from './OrdersScreen';
import SummaryScreen from './SummaryScreen';

export type RootStack = { Main: undefined; OrderDetail: { orderId: string } };

export default function MainScreen({ navigation }: NativeStackScreenProps<RootStack, 'Main'>) {
  const [tab, setTab] = useState<MainTab>('orders');
  const { orders } = useStore();
  const newCount = orders.filter((o) => o.stage === 'new').length;
  const openOrder = useCallback((o: Order) => navigation.navigate('OrderDetail', { orderId: o.id }), [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <StoreHeader />
      <ConnectionBanner />
      <View style={{ flex: 1 }}>
        {tab === 'orders' ? <OrdersScreen onOpenOrder={openOrder} onOpenSettings={() => setTab('more')} /> : null}
        {tab === 'menu' ? <MenuScreen /> : null}
        {tab === 'summary' ? <SummaryScreen /> : null}
        {tab === 'more' ? <MoreScreen /> : null}
      </View>
      <BottomNav value={tab} onChange={setTab} badge={newCount} />
      <NewOrderAlert />
    </View>
  );
}
