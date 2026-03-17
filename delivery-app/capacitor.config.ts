import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenvy.delivery',
  appName: 'Zenvy Delivery',
  webDir: 'out',
  server: {
    url: 'http://10.249.116.93:3001',
    cleartext: true
  }
};

export default config;
