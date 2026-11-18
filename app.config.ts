import type { ExpoConfig, ConfigContext } from 'expo/config';

// Keep in sync with APP_NAME in src/lib/config.ts (this file runs in Node).
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
  // Set by `eas init`; read from env so the config stays shareable.
  ...(process.env.EAS_OWNER ? { owner: process.env.EAS_OWNER } : {}),
  extra: {
    appName: APP_NAME,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
