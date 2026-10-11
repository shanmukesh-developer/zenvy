import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Coffee,
  Utensils,
  Sparkles,
  Gift,
  CheckCircle2,
  Heart,
  IndianRupee,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CampusColors, CampusLayout } from '../../../constants/campusTheme';

interface SnackItem {
  id: string;
  name: string;
  canteen: string;
  price: number;
  emoji: string;
}

const SNACK_MENU: SnackItem[] = [
  { id: 's1', name: 'Special Masala Chai', canteen: 'Canteen 1', price: 20, emoji: '☕' },
  { id: 's2', name: 'Hot Samosa Duo', canteen: 'Canteen 2', price: 30, emoji: '🥟' },
  { id: 's3', name: 'Midnight Butter Maggi', canteen: 'Night Mess', price: 45, emoji: '🍜' },
  { id: 's4', name: 'Hyderabadi Dum Biryani', canteen: 'Central Food Court', price: 160, emoji: '🍲' },
  { id: 's5', name: 'Choco Lava Cake', canteen: 'Campus Bakery', price: 65, emoji: '🍫' },
  { id: 's6', name: 'Cold Coffee with Ice Cream', canteen: 'Nescafe Kiosk', price: 55, emoji: '🥤' },
];

interface SnackGiftModalProps {
  visible: boolean;
  onClose: () => void;
  recipientName?: string;
  onGiftSent?: (snackName: string, recipient: string) => void;
}

export const SnackGiftModal: React.FC<SnackGiftModalProps> = ({
  visible,
  onClose,
  recipientName = 'Campus Buddy',
  onGiftSent,
}) => {
  const [selectedSnack, setSelectedSnack] = useState<SnackItem>(SNACK_MENU[0]);
  const [note, setNote] = useState('Chai & snacks treat on me! 🚀');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
    if (onGiftSent) {
      onGiftSent(selectedSnack.name, recipientName);
    }
    Alert.alert(
      '🎁 Treat Sent!',
      `You sent ${selectedSnack.emoji} ${selectedSnack.name} to ${recipientName}. +25 Buddy Points earned!`,
      [{ text: 'Awesome', onPress: onClose }]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={CampusColors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Send Campus Treat</Text>
            <Text style={styles.headerSubtitle}>Surprise {recipientName} with snacks</Text>
          </View>
          <View style={styles.giftIconWrap}>
            <Gift size={18} color={CampusColors.warmDeep} />
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.sectionHeader}>Select Snack or Beverage</Text>

          {/* Snack Grid */}
          <View style={styles.menuGrid}>
            {SNACK_MENU.map((snack) => {
              const active = selectedSnack.id === snack.id;
              return (
                <TouchableOpacity
                  key={snack.id}
                  style={[styles.snackCard, active && styles.snackCardActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedSnack(snack);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.snackEmoji}>{snack.emoji}</Text>
                  <Text style={styles.snackName} numberOfLines={1}>{snack.name}</Text>
                  <Text style={styles.canteenText}>{snack.canteen}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>₹{snack.price}</Text>
                    {active && <CheckCircle2 size={16} color={CampusColors.accent} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Treat Note */}
          <View style={styles.noteSection}>
            <Text style={styles.sectionHeader}>Personal Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Add sweet note for your friend..."
              placeholderTextColor={CampusColors.muted}
              value={note}
              onChangeText={setNote}
              maxLength={120}
            />
          </View>

          {/* Order Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Treat Item</Text>
              <Text style={styles.summaryValue}>{selectedSnack.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivering To</Text>
              <Text style={styles.summaryValue}>{recipientName}</Text>
            </View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: CampusColors.line, paddingTop: 10 }]}>
              <Text style={[styles.summaryLabel, { fontWeight: '700', color: CampusColors.ink }]}>Total Amount</Text>
              <Text style={styles.totalPrice}>₹{selectedSnack.price}</Text>
            </View>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendBtn, sent && styles.sendBtnDone]}
            onPress={handleSend}
            disabled={sent}
          >
            <Gift size={18} color="#FFFFFF" />
            <Text style={styles.sendBtnText}>
              {sent ? 'Treat Sent!' : `Pay ₹${selectedSnack.price} & Send Treat`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CampusColors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: CampusColors.card,
    borderBottomWidth: 1,
    borderBottomColor: CampusColors.line,
  },
  closeBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  headerSubtitle: {
    fontSize: 11,
    color: CampusColors.warm,
    fontWeight: '600',
  },
  giftIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CampusColors.warmSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: CampusColors.ink,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  snackCard: {
    width: '48%',
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: CampusColors.line,
  },
  snackCardActive: {
    borderColor: CampusColors.accent,
    backgroundColor: CampusColors.accentSoft,
  },
  snackEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  snackName: {
    fontSize: 13,
    fontWeight: '700',
    color: CampusColors.ink,
    marginBottom: 2,
  },
  canteenText: {
    fontSize: 10,
    color: CampusColors.muted,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: CampusColors.ink,
  },
  noteSection: {
    gap: 8,
  },
  noteInput: {
    backgroundColor: CampusColors.card,
    borderWidth: 1,
    borderColor: CampusColors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: CampusColors.ink,
  },
  summaryCard: {
    backgroundColor: CampusColors.card,
    borderRadius: CampusLayout.radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: CampusColors.line,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 12,
    color: CampusColors.muted,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: CampusColors.ink,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: CampusColors.warm,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CampusColors.warm,
    height: 48,
    borderRadius: CampusLayout.radius.pill,
    gap: 8,
    marginTop: 8,
  },
  sendBtnDone: {
    backgroundColor: '#059669',
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
