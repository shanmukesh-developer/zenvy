import { Platform, StatusBar } from 'react-native';

// react-native-safe-area-context is not installed: conservative fixed insets.
export const TOP_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 47;
export const BOTTOM_INSET = Platform.OS === 'ios' ? 28 : 12;
