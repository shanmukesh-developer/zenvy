// Zenvy Rider: root switch (Splash → Login → Pending approval → Shell).
// State: src/state/RiderStore. Screens: src/screens. API/socket/queue: src/services. Voice: src/voice.
import React from 'react';
import { StatusBar, View } from 'react-native';
import { BOTTOM_INSET, C, TOP_INSET } from './src/theme';
import { Toast } from './src/ui/Toast';
import { RiderProvider, useRider } from './src/state/RiderStore';
import { LoginScreen, PendingScreen, SplashScreen } from './src/screens/Auth';
import { Shell } from './src/screens/Shell';

function Root() {
  const { phase, toast, deliveryId, overlay } = useRider();
  let screen: React.ReactNode;
  if (phase === 'splash' || phase === 'splash-error') screen = <SplashScreen />;
  else if (phase === 'login') screen = <LoginScreen />;
  else if (phase === 'pending') screen = <PendingScreen />;
  else screen = <Shell />;
  const tabBarVisible = phase === 'main' && !deliveryId && !overlay;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: phase === 'main' ? TOP_INSET : 0 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} translucent />
      {screen}
      <Toast toast={toast} bottom={(tabBarVisible ? 84 : 104) + BOTTOM_INSET} />
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
