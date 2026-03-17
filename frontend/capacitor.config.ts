import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenvy.app',
  appName: 'Zenvy',
  webDir: 'out',
  server: {
    url: 'http://10.249.116.93:3000',
    cleartext: true
  }
};

export default config;
