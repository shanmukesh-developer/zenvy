import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { FriendsColors, FS, FT, fui } from '../friendsTheme';

/** Empty state for dark Friends surfaces. */
export const FriendsEmpty: React.FC<{
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}> = ({ icon, title, subtitle, actionLabel, onAction, secondaryLabel, onSecondary, compact }) => (
  <View style={[styles.wrap, compact && { paddingVertical: FS.xl }]}>
    {icon ? <View style={styles.icon}>{icon}</View> : null}
    <Text style={[FT.h3, { textAlign: 'center' }]} accessibilityRole="header">
      {title}
    </Text>
    {subtitle ? <Text style={[FT.muted, { textAlign: 'center', marginTop: 6 }]}>{subtitle}</Text> : null}
    {actionLabel && onAction ? (
      <TouchableOpacity style={[fui.primaryBtn, { marginTop: FS.lg, alignSelf: 'stretch' }]} onPress={onAction} accessibilityRole="button" activeOpacity={0.85}>
        <Text style={fui.primaryBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
    {secondaryLabel && onSecondary ? (
      <TouchableOpacity style={[fui.ghostBtn, { marginTop: FS.sm, alignSelf: 'stretch' }]} onPress={onSecondary} accessibilityRole="button" activeOpacity={0.85}>
        <Text style={fui.ghostBtnText}>{secondaryLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

/** Error state with Retry for dark Friends surfaces. */
export const FriendsError: React.FC<{ message: string; onRetry?: () => void; compact?: boolean }> = ({ message, onRetry, compact }) => (
  <FriendsEmpty
    compact={compact}
    icon={<WifiOff size={22} color={FriendsColors.warn} />}
    title="Something went wrong"
    subtitle={message}
    actionLabel={onRetry ? 'Retry' : undefined}
    onAction={onRetry}
  />
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: FS.xl },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FriendsColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: FS.md,
  },
});
