import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronLeft } from 'lucide-react-native';
import { FriendsColors, FS, FT } from '../friendsTheme';

/** Dark bottom sheet for Friends. Android back and the backdrop close it. */
export const FriendsSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  maxHeight?: `${number}%` | number;
  footer?: React.ReactNode;
}> = ({ visible, onClose, title, subtitle, icon, children, scroll = true, maxHeight = '88%', footer }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { maxHeight }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            {icon}
            <View style={{ flex: 1 }}>
              <Text style={FT.h2} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? (
                <Text style={FT.small} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close">
            <X size={20} color={FriendsColors.muted} />
          </TouchableOpacity>
        </View>
        {scroll ? (
          <ScrollView contentContainerStyle={{ paddingBottom: FS.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          children
        )}
        {footer}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

/** Dark full-screen page for Friends. Android back and the header arrow go back. */
export const FriendsScreenModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ visible, onClose, title, subtitle, right, children }) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: FriendsColors.bg }} edges={['top', 'bottom']}>
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color={FriendsColors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={FT.h2} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={FT.small} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </SafeAreaView>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: FriendsColors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: FriendsColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: FriendsColors.line,
    paddingHorizontal: FS.xl,
    paddingTop: FS.sm,
    paddingBottom: Platform.OS === 'ios' ? FS.xxl : FS.lg,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: FriendsColors.line, marginBottom: FS.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: FS.md,
    marginBottom: FS.md,
    borderBottomWidth: 1,
    borderBottomColor: FriendsColors.line,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FS.sm,
    paddingHorizontal: FS.sm,
    paddingVertical: FS.sm,
    backgroundColor: FriendsColors.bg,
    borderBottomWidth: 1,
    borderBottomColor: FriendsColors.line,
  },
});
