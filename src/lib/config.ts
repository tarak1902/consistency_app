import Constants from 'expo-constants';

/** Rename the product here. */
export const APP_NAME = 'Compound';

// EXPO_PUBLIC_* values are inlined at build time; they must be referenced
// literally for Metro to replace them.
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://example.com/terms',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://example.com/privacy',
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;

export const isSupabaseConfigured = (): boolean =>
  config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
