import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { useWorldTransition } from '../../context/WorldTransitionContext';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { Ionicons } from '@expo/vector-icons';
import { playSound, resumeAudio } from '../../utils/sounds';

function TabIcon({ name, focused, iconName, isDark, badgeCount }: { name: string; focused: boolean; iconName: any; isDark: boolean; badgeCount?: number }) {
  const inactiveColor = isDark ? '#71717A' : '#64748B';
  const labelColor = isDark ? '#A1A1AA' : '#64748B';

  return (
    <View style={styles.tabIconWrap}>
      {focused && <View style={styles.activeIndicator} />}
      <View style={{ position: 'relative' }}>
        <Ionicons 
          name={focused ? iconName : `${iconName}-outline`} 
          size={22} 
          color={focused ? COLORS.red : inactiveColor} 
          style={focused ? styles.tabIconActive : styles.tabIcon}
        />
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.cartBadge, { borderColor: isDark ? '#09090B' : '#FFFFFF' }]}>
            <Text style={styles.cartBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, { color: focused ? COLORS.red : labelColor, fontWeight: focused ? '900' : '700' }]}>
        {name}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { triggerTransition } = useWorldTransition();
  const { isDark, colors } = useTheme();
  const { totalItems } = useCart();
  const insets = useSafeAreaInsets();

  // Only Home and Others get the cinematic world transition.
  // Orders, Basket, Profile switch instantly — no overlay needed.
  const makeTransitionListener = (path: string, world: any) => ({
    tabPress: (e: any) => {
      e.preventDefault();
      triggerTransition(path, world);
    }
  });

  // Theme-aware tab bar style
  const tabBarStyle = {
    backgroundColor: isDark ? '#09090B' : '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    height: Platform.OS === 'ios' ? 88 : 60 + insets.bottom,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : insets.bottom > 0 ? insets.bottom : 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDark ? 0.35 : 0.06,
    shadowRadius: 12,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabBarStyle,
        tabBarShowLabel: false,
      }}
    >
      {/* Home & Others — cinematic world transition */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} iconName="home" isDark={isDark} />,
        }}
        listeners={{
          tabPress: () => {
            resumeAudio();
            playSound('tabSwitch');
          }
        }}
      />
      <Tabs.Screen
        name="others"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Others" focused={focused} iconName="grid" isDark={isDark} />,
        }}
        listeners={{
          tabPress: () => {
            resumeAudio();
            playSound('tabSwitch');
          }
        }}
      />

      {/* Orders, Basket, Profile — instant switch, no transition */}
      <Tabs.Screen
        name="orders"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Orders" focused={focused} iconName="receipt" isDark={isDark} />,
        }}
        listeners={{
          tabPress: () => {
            resumeAudio();
            playSound('tabSwitch');
          }
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Basket" focused={focused} iconName="cart" isDark={isDark} badgeCount={totalItems} />,
        }}
        listeners={{
          tabPress: () => {
            resumeAudio();
            playSound('tabSwitch');
          }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} iconName="person" isDark={isDark} />,
        }}
        listeners={{
          tabPress: () => {
            resumeAudio();
            playSound('tabSwitch');
          }
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -12,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.red,
  },
  tabIcon: {
    opacity: 0.65,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
});
