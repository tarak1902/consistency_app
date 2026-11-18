import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, View } from 'react-native';
import {
  Button,
  Card,
  ListRow,
  Screen,
  SectionLabel,
  SegmentedControl,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { useAuth } from '@/data/auth';
import { errorMessage } from '@/data/errors';
import { deleteAccount } from '@/data/mutations';
import { useCurrentPlan, useProfileName } from '@/data/queries';
import { usePlanComputed } from '@/features/plan/usePlanComputed';
import { config } from '@/lib/config';
import { exportCsv, exportJson } from '@/lib/exportData';
import { haptics } from '@/lib/haptics';
import {
  getPrefs,
  permissionState,
  requestPermission,
  reschedule,
  setPrefs,
  type NotifPrefs,
  type PermissionState,
} from '@/lib/notifications';
import { space, touchTarget, useTheme, type ThemePreference } from '@/theme';

export default function SettingsScreen() {
  const { c, preference, setPreference } = useTheme();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const profileName = useProfileName(user?.id);
  const current = useCurrentPlan();
  const computed = usePlanComputed(current.bundle?.plan.id);

  const [prefs, setPrefsState] = useState<NotifPrefs>({ open: true, lastCall: true });
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const refresh = () => {
      getPrefs()
        .then(setPrefsState)
        .catch(() => undefined);
      permissionState()
        .then(setPerm)
        .catch(() => undefined);
    };
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, []);

  const name = useMemo(() => {
    const meta = user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
    const fromMeta =
      typeof meta?.full_name === 'string'
        ? meta.full_name
        : typeof meta?.name === 'string'
          ? meta.name
          : null;
    return profileName.data ?? fromMeta ?? t.settings.notSet;
  }, [user, profileName.data]);

  const updatePrefs = async (next: NotifPrefs) => {
    let p = perm;
    if ((next.open || next.lastCall) && p !== 'granted') {
      p = await requestPermission();
      setPerm(p);
    }
    setPrefsState(next);
    await setPrefs(next);
    const b = computed.bundle;
    await reschedule(b?.plan ?? null, computed.state, computed.now);
  };

  const runExport = async (kind: 'json' | 'csv') => {
    setExporting(kind);
    try {
      if (kind === 'json') await exportJson();
      else await exportCsv();
    } catch (e) {
      toast.show(errorMessage(e), 'decline');
    } finally {
      setExporting(null);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      haptics.success();
      setDeleteStep(0);
      await signOut().catch(() => undefined);
      toast.show(t.settings.deleted);
      router.replace('/sign-in');
    } catch (e) {
      haptics.warning();
      toast.show(errorMessage(e), 'decline');
    } finally {
      setDeleting(false);
    }
  };

  const notifDisabled = perm === 'denied';

  return (
    <Screen>
      <ScreenHeader title={t.settings.title} />

      <Section title={t.settings.account}>
        <ListRow label={t.settings.name} value={name} />
        <ListRow label={t.settings.email} value={user?.email ?? t.settings.notSet} />
        <ListRow
          label={t.settings.signOut}
          tone="accent"
          chevron={false}
          onPress={() => {
            signOut()
              .then(() => router.replace('/sign-in'))
              .catch(() => undefined);
          }}
          isLast
        />
      </Section>

      <Section title={t.settings.appearance}>
        <View style={styles.pad}>
          <SegmentedControl<ThemePreference>
            options={[
              { value: 'system', label: t.settings.system },
              { value: 'dark', label: t.settings.dark },
              { value: 'light', label: t.settings.light },
            ]}
            value={preference}
            onChange={setPreference}
            accessibilityLabel={t.settings.appearance}
          />
        </View>
      </Section>

      <Section title={t.settings.notifications}>
        <ListRow
          label={t.settings.notifOpen}
          chevron={false}
          right={
            <Switch
              value={prefs.open && perm === 'granted'}
              disabled={notifDisabled}
              onValueChange={(v) => void updatePrefs({ ...prefs, open: v })}
              trackColor={{ true: c.accent, false: c.border }}
              accessibilityLabel={t.settings.notifOpen}
            />
          }
        />
        <ListRow
          label={t.settings.notifLast}
          chevron={false}
          isLast={!notifDisabled}
          right={
            <Switch
              value={prefs.lastCall && perm === 'granted'}
              disabled={notifDisabled}
              onValueChange={(v) => void updatePrefs({ ...prefs, lastCall: v })}
              trackColor={{ true: c.accent, false: c.border }}
              accessibilityLabel={t.settings.notifLast}
            />
          }
        />
        {notifDisabled ? (
          <View style={styles.note}>
            <Text variant="callout" tone="secondary" style={styles.flex}>
              {t.settings.notifDenied}
            </Text>
            <Button
              label={t.settings.openSystemSettings}
              variant="ghost"
              size="md"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : null}
      </Section>

      <Section title={t.plan.detailsTitle}>
        {current.bundle ? (
          <ListRow
            label={t.settings.planDetails}
            onPress={() =>
              router.push({ pathname: '/plan/[id]', params: { id: current.bundle?.plan.id ?? '' } })
            }
          />
        ) : null}
        <ListRow
          label={t.settings.howScoring}
          onPress={() => router.push('/settings/scoring')}
          isLast
        />
      </Section>

      <Section title={t.settings.data}>
        <ListRow
          label={exporting === 'json' ? t.common.loading : t.settings.exportJson}
          onPress={exporting ? undefined : () => void runExport('json')}
        />
        <ListRow
          label={exporting === 'csv' ? t.common.loading : t.settings.exportCsv}
          onPress={exporting ? undefined : () => void runExport('csv')}
          isLast
        />
      </Section>

      <Section title={t.settings.legal}>
        <ListRow
          label={t.settings.privacy}
          onPress={() => void WebBrowser.openBrowserAsync(config.privacyUrl)}
        />
        <ListRow
          label={t.settings.terms}
          onPress={() => void WebBrowser.openBrowserAsync(config.termsUrl)}
          isLast
        />
      </Section>

      <Card>
        <ListRow
          label={t.settings.deleteAccount}
          tone="destructive"
          chevron={false}
          onPress={() => {
            setDeleteText('');
            setDeleteStep(1);
          }}
          isLast={!__DEV__}
        />
        {__DEV__ ? (
          <ListRow label={t.settings.devGallery} onPress={() => router.push('/dev/ui')} isLast />
        ) : null}
      </Card>

      <Text variant="caption" tone="tertiary" align="center">
        {`${t.appName} ${'·'} ${t.settings.version(config.appVersion)}`}
      </Text>

      <Sheet
        visible={deleteStep > 0}
        onClose={() => setDeleteStep(0)}
        title={t.settings.deleteTitle}
      >
        <Text variant="body" tone="secondary">
          {t.settings.deleteBody}
        </Text>
        {deleteStep === 1 ? (
          <>
            <Button
              label={t.common.continue}
              variant="destructive"
              onPress={() => setDeleteStep(2)}
            />
            <Button label={t.common.cancel} variant="ghost" onPress={() => setDeleteStep(0)} />
          </>
        ) : (
          <>
            <TextField
              label={t.settings.deleteStep2}
              value={deleteText}
              onChangeText={setDeleteText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
            />
            <Button
              label={t.settings.deleteConfirm}
              variant="destructive"
              disabled={deleteText.trim() !== 'DELETE'}
              loading={deleting}
              onPress={() => void doDelete()}
            />
            <Button label={t.common.cancel} variant="ghost" onPress={() => setDeleteStep(0)} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionLabel>{title}</SectionLabel>
      <Card padded={false} style={styles.card}>
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.xs },
  card: { paddingHorizontal: space.md },
  pad: { paddingVertical: space.sm },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget,
    paddingBottom: space.sm,
  },
});
