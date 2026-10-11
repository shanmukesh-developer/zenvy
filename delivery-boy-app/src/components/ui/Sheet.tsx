import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '../../theme/tokens';
import { IconButton } from './Buttons';
import { BOTTOM_INSET } from './insets';

/** Bottom sheet on a Modal. Android back closes it (unless `blocking`). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  blocking,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  blocking?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={blocking ? () => {} : onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={blocking ? undefined : onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <Text style={[type.title2, { color: color.text, flex: 1 }]}>{title}</Text>
              {!blocking ? <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" /> : null}
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ gap: space.sm, paddingTop: space.xs }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,13,18,0.55)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: BOTTOM_INSET + space.md,
    maxHeight: '90%',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.border, marginBottom: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, gap: space.sm },
});
