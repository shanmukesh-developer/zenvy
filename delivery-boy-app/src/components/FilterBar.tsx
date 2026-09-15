import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export type CategoryFilter = 'ALL' | 'Food' | 'Fruits' | 'Groceries' | 'Mega Basket';
export type SlotFilter = 'ALL' | 'Before 7:30 PM' | 'After 7:30 PM' | '1:00 PM - 6:00 PM';
export type StageFilter = 'ALL' | 'Picking' | 'PickedUp' | 'ArrivedAtGate';

interface FilterBarProps {
  selectedCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  selectedSlot: SlotFilter;
  onSelectSlot: (slot: SlotFilter) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedSlot,
  onSelectSlot,
}) => {
  const categories: { label: string; value: CategoryFilter }[] = [
    { label: 'ALL RUNS', value: 'ALL' },
    { label: 'FOOD', value: 'Food' },
    { label: 'GROCERIES', value: 'Groceries' },
    { label: 'MEGA BASKET', value: 'Mega Basket' },
    { label: 'FRUITS', value: 'Fruits' },
  ];

  const slots: { label: string; value: SlotFilter }[] = [
    { label: 'ANY TIME', value: 'ALL' },
    { label: 'BEFORE 7:30 PM', value: 'Before 7:30 PM' },
    { label: 'AFTER 7:30 PM', value: 'After 7:30 PM' },
  ];

  const handleCatPress = (cat: CategoryFilter) => {
    Vibration.vibrate(15);
    onSelectCategory(cat);
  };

  const handleSlotPress = (slot: SlotFilter) => {
    Vibration.vibrate(15);
    onSelectSlot(slot);
  };

  return (
    <View style={styles.container}>
      {/* Category Filter Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((item) => {
          const isSelected = selectedCategory === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.chip,
                isSelected ? styles.chipActive : styles.chipInactive,
              ]}
              onPress={() => handleCatPress(item.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.vDivider} />

        {slots.map((item) => {
          const isSelected = selectedSlot === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.chip,
                isSelected ? styles.chipActiveSlot : styles.chipInactive,
              ]}
              onPress={() => handleSlotPress(item.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextActiveSlot : styles.chipTextInactive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  chipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  chipActive: {
    backgroundColor: COLORS.goldMuted,
    borderColor: COLORS.goldBorder,
  },
  chipActiveSlot: {
    backgroundColor: COLORS.emeraldMuted,
    borderColor: COLORS.emeraldBorder,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  chipTextInactive: {
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.goldLight,
  },
  chipTextActiveSlot: {
    color: COLORS.emeraldLight,
  },
  vDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 4,
  },
});
