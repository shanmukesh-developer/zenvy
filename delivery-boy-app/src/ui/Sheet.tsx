// Bottom sheet on a Modal. Android back closes it unless `blocking`.
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BOTTOM_INSET, C, R, S, T } from '../theme';
import { IconBtn } from './kit';

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
              <Text style={[T.h2, { color: C.ink, flex: 1 }]}>{title}</Text>
              {!blocking ? <IconBtn icon="close" onPress={onClose} label="Close" bg={C.cardAlt} /> : null}
            </View>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.lg, paddingBottom: S.md }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ gap: S.sm, paddingTop: S.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
    paddingBottom: BOTTOM_INSET + S.lg,
    maxHeight: '92%',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: S.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: S.md, gap: S.sm },
});
