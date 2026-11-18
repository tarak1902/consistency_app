import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button, Text, useToast } from '@/components';
import { CompoundCurves } from '@/components/CompoundCurves';
import { t } from '@/copy/en';
import {
  NotConfiguredError,
  isAppleAvailable,
  signInWithApple,
  signInWithGoogle,
} from '@/data/auth';
import { haptics } from '@/lib/haptics';
import { config } from '@/lib/config';
import { radius, screenPadding, space, useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignIn() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    isAppleAvailable()
      .then(setApple)
      .catch(() => setApple(false));
  }, []);

  const run = async (kind: 'google' | 'apple') => {
    setBusy(kind);
    try {
      const res = kind === 'google' ? await signInWithGoogle() : await signInWithApple();
      if (res === 'ok') router.replace('/today');
    } catch (e) {
      haptics.warning();
      toast.show(
        e instanceof NotConfiguredError
          ? t.auth.notConfigured
          : kind === 'google'
            ? t.auth.googleFailed
            : t.auth.appleFailed,
        'decline',
      );
    } finally {
      setBusy(null);
    }
  };

  const curve = Array.from({ length: 40 }, (_, i) => Math.pow(1.02, i));

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop: insets.top + space.xxl,
          paddingBottom: insets.bottom + space.lg,
        },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.mark}>
          <CompoundCurves curves={[{ values: curve, color: c.accent, width: 3 }]} height={56} />
        </View>
        <Text variant="display" accessibilityRole="header">
          {t.appName}
        </Text>
        <Text variant="body" tone="secondary">
          {t.tagline}
        </Text>
      </View>

      <View style={styles.actions}>
        {Platform.OS === 'ios' && apple ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.card}
            style={styles.apple}
            onPress={() => void run('apple')}
          />
        ) : null}
        <Button
          label={t.auth.google}
          variant="secondary"
          loading={busy === 'google'}
          disabled={busy !== null}
          onPress={() => void run('google')}
          icon={<Text variant="headline">G</Text>}
        />
        <Button
          label={t.auth.email}
          variant="secondary"
          disabled={busy !== null}
          onPress={() => router.push('/email')}
          icon={<Mail size={18} color={c.text} />}
        />
        <Text variant="caption" tone="tertiary" align="center" style={styles.small}>
          {`${t.auth.smallPrint} `}
          <Text
            variant="caption"
            tone="secondary"
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(config.termsUrl)}
            style={styles.link}
          >
            {t.auth.terms}
          </Text>
          {` ${t.auth.and} `}
          <Text
            variant="caption"
            tone="secondary"
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(config.privacyUrl)}
            style={styles.link}
          >
            {t.auth.privacy}
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: screenPadding, justifyContent: 'space-between' },
  hero: { gap: space.sm, marginTop: space.huge },
  mark: { width: 96, marginBottom: space.md },
  actions: { gap: space.sm },
  apple: { height: 52, width: '100%' },
  small: { marginTop: space.sm },
  link: { textDecorationLine: 'underline' },
});
