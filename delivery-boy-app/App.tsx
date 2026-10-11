// Zenvy Rider: root switch (Splash → Login → PendingApproval → Main).
// Screens live in src/screens, state in src/state/RiderProvider, services in src/services.
import React from 'react';
import { StatusBar, View } from 'react-native';
import { color } from './src/theme/tokens';
import { TOP_INSET, BOTTOM_INSET } from './src/components/ui/insets';
import { Toast } from './src/components/ui/Toast';
import { RiderProvider, useRider } from './src/state/RiderProvider';
import { LoginScreen, PendingApprovalScreen, SplashScreen } from './src/screens/AuthScreens';
import { MainScreen } from './src/screens/MainScreen';

function Root() {
  const { phase, toast, deliveryId, overlay } = useRider();
  let screen: React.ReactNode;
  if (phase === 'splash' || phase === 'splash-error') screen = <SplashScreen />;
  else if (phase === 'login') screen = <LoginScreen />;
  else if (phase === 'pending') screen = <PendingApprovalScreen />;
  else screen = <MainScreen />;
  const tabBarVisible = phase === 'main' && !deliveryId && !overlay;
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: phase === 'main' ? TOP_INSET : 0 }}>
      <StatusBar barStyle="dark-content" backgroundColor={color.bg} translucent />
      {screen}
      <Toast toast={toast} bottom={(tabBarVisible ? 76 : 96) + BOTTOM_INSET} />
    </View>
  );
}

export default function App() {
  return (
    <RiderProvider>
      <Root />
    </RiderProvider>
  );
}
