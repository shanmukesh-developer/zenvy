import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

interface ZenvyBadgeProps {
  label: string;
  variant?: 'gold' | 'emerald' | 'coral' | 'blue' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const ZenvyBadge: React.FC<ZenvyBadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  icon,
  style,
  textStyle,
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'gold':
        return {
          backgroundColor: COLORS.goldMuted,
          borderColor: COLORS.goldBorder,
        };
      case 'emerald':
        return {
          backgroundColor: COLORS.emeraldMuted,
          borderColor: COLORS.emeraldBorder,
        };
      case 'coral':
        return {
          backgroundColor: COLORS.coralMuted,
          borderColor: COLORS.coralBorder,
        };
      case 'blue':
        return {
          backgroundColor: COLORS.blueMuted,
          borderColor: 'rgba(59, 130, 246, 0.4)',
        };
      case 'neutral':
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: COLORS.borderSubtle,
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'gold':
        return COLORS.textGold;
      case 'emerald':
        return COLORS.textEmerald;
      case 'coral':
        return COLORS.coral;
      case 'blue':
        return '#60A5FA';
      case 'neutral':
      default:
        return COLORS.textSecondary;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 8,
          paddingVertical: 3,
          fontSize: 10,
        };
      case 'lg':
        return {
          paddingHorizontal: 14,
          paddingVertical: 6,
          fontSize: 13,
        };
      case 'md':
      default:
        return {
          paddingHorizontal: 10,
          paddingVertical: 4,
          fontSize: 11,
        };
    }
  };

  const sizeMetrics = getSizeStyle();

  return (
    <View
      style={[
        styles.badge,
        getBadgeStyle(),
        {
          paddingHorizontal: sizeMetrics.paddingHorizontal,
          paddingVertical: sizeMetrics.paddingVertical,
        },
        style,
      ]}
    >
      {icon && <View style={styles.iconBox}>{icon}</View>}
      <Text
        style={[
          styles.text,
          {
            color: getTextColor(),
            fontSize: sizeMetrics.fontSize,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  iconBox: {
    marginRight: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
