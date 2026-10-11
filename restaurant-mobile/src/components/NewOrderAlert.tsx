// Full-screen red NEW ORDER alert. Shows while any Pending order is unacknowledged; sound + vibration
// are driven by StoreProvider/alertLoop. Accept / Reject run inline; Silence only stops the sound.
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rupees } from '../services/orderModel';
import { useStore } from '../state/StoreProvider';
import { color, mono, radius, space, type } from '../theme/tokens';
import { ElapsedText, InstructionsCallout, ItemLines } from './OrderBits';
import { PrepTimePicker, RejectPicker } from './OrderPickers';
import { Badge, Button } from './ui';

export function NewOrderAlert() {
  const { alertOrders, silenceAlerts, soundOn } = useStore();
  const insets = useSafeAreaInsets();
  const order = alertOrders[0] || null;
  const [mode, setMode] = useState<'view' | 'accept' | 'reject'>('view');

  useEffect(() => { setMode('view'); }, [order?.id]);

  if (!order) return null;
  const more = alertOrders.length - 1;

  return (
    <Modal visible animationType="fade" onRequestClose={silenceAlerts} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
        <ScrollView contentContainerStyle={{ gap: space.md, paddingHorizontal: space.md, paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Ionicons name={soundOn ? 'notifications' : 'notifications-off'} size={32} color={color.textInverse} />
            <Text style={[type.title1, { color: color.textInverse, fontSize: 30, lineHeight: 36 }]}>NEW ORDER</Text>
          </View>
          {more > 0 ? (
            <View style={styles.more}><Text style={[type.body, { color: color.alertDark, fontWeight: '800' }]}>+{more} more new order{more > 1 ? 's' : ''}</Text></View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[type.orderId, mono, { color: color.text, fontSize: 26, lineHeight: 32 }]}>#{order.shortId}</Text>
                <ElapsedText order={order} />
              </View>
              {order.isCOD
                ? <Badge text="COD" icon="cash-outline" fg={color.cash} bg={color.cashTint} border={color.cashBorder} />
                : <Badge text="PREPAID" icon="wallet-outline" fg={color.prepaid} bg={color.prepaidTint} />}
            </View>
            <Text style={[type.body, { color: color.textSecondary }]}>
              {order.customerName || 'Customer'} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
            </Text>
            <ItemLines order={order} />
            <InstructionsCallout order={order} />
            <View style={[styles.row, styles.total]}>
              <Text style={[type.body, { color: color.textSecondary, flex: 1 }]}>Item total</Text>
              <Text style={[type.money, { color: color.text }]}>{rupees(order.totalPrice)}</Text>
            </View>
          </View>

          {mode === 'accept' ? (
            <PrepTimePicker order={order} inverse onDone={() => setMode('view')} onCancel={() => setMode('view')} />
          ) : mode === 'reject' ? (
            <RejectPicker order={order} inverse onDone={() => setMode('view')} onCancel={() => setMode('view')} />
          ) : (
            <View style={{ gap: space.sm }}>
              <Button label="ACCEPT" variant="accept" icon="checkmark-circle" onPress={() => setMode('accept')} style={{ minHeight: 72 }} />
              <View style={styles.row}>
                <Button label="Reject" variant="inverse" onPress={() => setMode('reject')} style={{ flex: 1 }} />
                <Button
                  label="Silence"
                  variant="ghost"
                  icon="volume-mute"
                  textColor={color.textInverse}
                  onPress={silenceAlerts}
                  style={{ flex: 1, borderWidth: 2, borderColor: color.textInverse }}
                  accessibilityLabel="Silence the alert. The order stays in New"
                />
              </View>
              <Text style={[type.bodySm, { color: color.textInverse, textAlign: 'center' }]}>Silence stops the sound. The order stays in New.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.alert },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' },
  more: { alignSelf: 'center', backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xxs },
  panel: { backgroundColor: color.surface, borderRadius: radius.xl, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  total: { borderTopWidth: 1, borderTopColor: color.surfaceAlt, paddingTop: space.sm },
});
