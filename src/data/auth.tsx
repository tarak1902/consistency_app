import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { config, isSupabaseConfigured } from '@/lib/config';
import { queryClient } from './QueryProvider';
import { supabase } from './supabase';

const ONBOARDED_KEY = 'compound.onboarded';

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  onboarded: boolean;
  setOnboarded: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [onboarded, setOnb] = useState(false);
  const [onbReady, setOnbReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .catch(() => undefined)
      .finally(() => mounted && setSessionReady(true));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => mounted && setOnb(v === '1'))
      .catch(() => undefined)
      .finally(() => mounted && setOnbReady(true));
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready: sessionReady && onbReady,
      session,
      user: session?.user ?? null,
      onboarded,
      setOnboarded: async () => {
        setOnb(true);
        await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => undefined);
      },
      signOut: async () => {
        await signOutGoogle();
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [sessionReady, onbReady, session, onboarded],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Sign-in methods
// ---------------------------------------------------------------------------

export type SignInResult = 'ok' | 'cancelled';

export class NotConfiguredError extends Error {}

function assertConfigured() {
  if (!isSupabaseConfigured()) throw new NotConfiguredError('Supabase is not configured');
}

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: GoogleModule | null = null;
let googleConfigured = false;

async function google(): Promise<GoogleModule> {
  if (!googleModule) googleModule = await import('@react-native-google-signin/google-signin');
  if (!googleConfigured) {
    googleModule.GoogleSignin.configure({
      webClientId: config.googleWebClientId,
      iosClientId: config.googleIosClientId || undefined,
    });
    googleConfigured = true;
  }
  return googleModule;
}

async function signOutGoogle(): Promise<void> {
  if (!googleModule) return;
  await googleModule.GoogleSignin.signOut().catch(() => undefined);
}

export async function signInWithGoogle(): Promise<SignInResult> {
  assertConfigured();
  if (!config.googleWebClientId) throw new NotConfiguredError('Google client id missing');
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await google();
  try {
    if (Platform.OS === 'android')
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return 'cancelled';
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('No Google id token');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if (
      isErrorWithCode(e) &&
      (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)
    ) {
      return 'cancelled';
    }
    throw e;
  }
}

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function signInWithApple(): Promise<SignInResult> {
  assertConfigured();
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!cred.identityToken) throw new Error('No Apple identity token');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: cred.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;
    // Apple only shares the name on the first sign-in; keep it.
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
    if (name) await supabase.auth.updateUser({ data: { full_name: name } }).catch(() => undefined);
    return 'ok';
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return 'cancelled';
    }
    throw e;
  }
}

export async function sendEmailCode(email: string): Promise<void> {
  assertConfigured();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}
