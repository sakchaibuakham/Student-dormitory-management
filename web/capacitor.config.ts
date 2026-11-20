import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dormmate.app',
  appName: 'DormMate',
  webDir: 'public',
  server: {
    url: 'http://192.168.1.101:3000',
    cleartext: true
  }
};

export default config;