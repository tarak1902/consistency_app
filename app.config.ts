import type { ExpoConfig, ConfigContext } from 'expo/config';

const APP_NAME = 'Compound';
const BUNDLE_ID = 'app.compound.consistency';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'compound',
  scheme: 'compound',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0B0D10',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0B0D10',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-apple-authentication',
    'expo-sharing',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 120,
        resizeMode: 'contain',
        backgroundColor: '#FAFAF7',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0B0D10' },
      },
    ],
    [
      'expo-notifications',
      {
        color: '#8B97FF',
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME ?? 'com.googleusercontent.apps.placeholder',
      },
    ],
    '@sentry/react-native',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appName: APP_NAME,
  },
});
