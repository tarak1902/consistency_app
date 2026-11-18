import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Button, Screen, Text, TextField } from '@/components';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { NotConfiguredError, sendEmailCode } from '@/data/auth';
import { errorMessage, toAppError } from '@/data/errors';
import { haptics } from '@/lib/haptics';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function EmailScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL.test(value)) {
      setError(t.auth.emailInvalid);
      haptics.warning();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendEmailCode(value);
      router.push({ pathname: '/verify', params: { email: value } });
    } catch (e) {
      haptics.warning();
      setError(
        e instanceof NotConfiguredError
          ? t.auth.notConfigured
          : toAppError(e).code === 'SERVER'
            ? t.auth.sendFailed
            : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={<Button label={t.auth.sendCode} onPress={() => void submit()} loading={busy} />}
      >
        <ScreenHeader title={t.auth.emailTitle} />
        <Text variant="body" tone="secondary">
          {t.auth.emailBody}
        </Text>
        <TextField
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) setError(null);
          }}
          placeholder={t.auth.emailPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          autoFocus
          error={error}
          accessibilityLabel={t.auth.emailTitle}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
