import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button, Screen, Text, useToast } from '@/components';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { sendEmailCode, verifyEmailCode } from '@/data/auth';
import { errorMessage, toAppError } from '@/data/errors';
import { haptics } from '@/lib/haptics';
import { fonts, radius, space, useTheme } from '@/theme';

const LENGTH = 6;
const RESEND_S = 30;

export default function VerifyScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(RESEND_S);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const verify = async (value: string) => {
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, value);
      haptics.success();
      router.replace('/today');
    } catch (e) {
      haptics.warning();
      const msg = toAppError(e).detail ?? '';
      setError(
        /expired/i.test(msg)
          ? t.auth.codeExpired
          : /invalid|token/i.test(msg)
            ? t.auth.codeWrong
            : errorMessage(e),
      );
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === LENGTH) void verify(digits);
  };

  const resend = async () => {
    if (!email || left > 0) return;
    try {
      await sendEmailCode(email);
      setLeft(RESEND_S);
      toast.show(t.auth.resent);
    } catch (e) {
      toast.show(errorMessage(e), 'decline');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={left > 0 ? t.auth.resendIn(left) : t.auth.resend}
            variant="secondary"
            disabled={left > 0}
            onPress={() => void resend()}
          />
        }
      >
        <ScreenHeader title={t.auth.codeTitle} />
        <Text variant="body" tone="secondary">
          {t.auth.codeBody(email ?? '')}
        </Text>

        <Pressable onPress={() => input.current?.focus()} accessible={false} style={styles.cells}>
          {Array.from({ length: LENGTH }, (_, i) => {
            const ch = code[i] ?? '';
            const active = i === Math.min(code.length, LENGTH - 1) && !busy;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  {
                    backgroundColor: c.surface2,
                    borderColor: error ? c.decline : active ? c.accent : c.border,
                  },
                ]}
              >
                <Text variant="title1" numeric>
                  {ch}
                </Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          autoFocus
          editable={!busy}
          caretHidden
          accessibilityLabel={t.auth.codeTitle}
          style={styles.hidden}
        />
        {error ? (
          <Text variant="callout" tone="decline" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
        <Button
          label={t.auth.changeEmail}
          variant="ghost"
          size="md"
          onPress={() => router.back()}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cells: { flexDirection: 'row', gap: space.xs, justifyContent: 'space-between' },
  cell: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    borderRadius: radius.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', opacity: 0.01, height: 1, width: 1, fontFamily: fonts.regular },
});
