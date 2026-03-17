import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.srm.hostelbites',
  appName: 'Zenvy',
  webDir: 'out',
  server: {
    url: 'https://hostelbites-customer.onrender.com',
    cleartext: true
  }
};

export default config;
