import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Provself',
  slug: 'provself',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'provself',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.provself.app',
    buildNumber: '1',
    infoPlist: {
      NSHealthShareUsageDescription:
        'Provself needs access to your health data to automatically verify your fitness challenges.',
      NSHealthUpdateUsageDescription:
        'Provself needs access to write health data for challenge tracking.',
      NSCameraUsageDescription:
        'Provself needs camera access to take proof photos for challenge verification.',
      NSPhotoLibraryUsageDescription:
        'Provself needs photo library access to select proof photos.',
    },
    entitlements: {
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.background-delivery': true,
      'com.apple.developer.in-app-purchases': true,
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-notifications',
      {
        color: '#000000',
      },
    ],
    // react-native-purchases plugin is only needed for EAS builds (not Expo Go)
    // It will be added automatically when building with EAS
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID',
    },
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    revenueCatApiKey: process.env.REVENUECAT_API_KEY,
  },
});
