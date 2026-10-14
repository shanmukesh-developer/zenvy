/**
 * App-wide keyboard avoidance (Android edge-to-edge + iOS).
 *
 * Android 15 / RN 0.86 runs edge-to-edge, so `softwareKeyboardLayoutMode: "resize"` no longer
 * shrinks the window and React Native's own KeyboardAvoidingView does nothing useful there.
 * This wrapper uses react-native-keyboard-controller (needs <KeyboardProvider> in app/_layout.tsx),
 * which reads the real keyboard insets on both platforms, and `automaticOffset` so it also works
 * below headers and inside Modals / bottom sheets without hand-tuned offsets.
 *
 * Drop-in for `import { KeyboardAvoidingView } from 'react-native'`: platform-specific
 * `behavior` / `keyboardVerticalOffset` values written for the RN component are ignored.
 * Web: the browser handles the keyboard, so it renders a plain View.
 */
import React from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { KeyboardAvoidingView as KCKeyboardAvoidingView } from 'react-native-keyboard-controller';

type Props = ViewProps & {
  behavior?: 'height' | 'position' | 'padding' | 'translate-with-padding';
  keyboardVerticalOffset?: number;
  enabled?: boolean;
  contentContainerStyle?: ViewProps['style'];
  children?: React.ReactNode;
};

export function KeyboardAvoidingView({ behavior, keyboardVerticalOffset: _ignored, enabled = true, ...rest }: Props) {
  if (Platform.OS === 'web') {
    const { contentContainerStyle: _c, ...viewProps } = rest;
    return <View {...viewProps} />;
  }
  return (
    <KCKeyboardAvoidingView
      {...rest}
      enabled={enabled}
      behavior={behavior === 'position' || behavior === 'translate-with-padding' ? behavior : 'padding'}
      automaticOffset
    />
  );
}

export default KeyboardAvoidingView;
