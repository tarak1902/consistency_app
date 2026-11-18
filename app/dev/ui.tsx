import { Redirect, Stack } from 'expo-router';
import { Settings, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  ColorDot,
  DeltaBadge,
  EmptyState,
  ErrorState,
  HeatmapCalendar,
  HoldToConfirmButton,
  IconButton,
  LineChart,
  ListRow,
  OfflineBanner,
  Pill,
  ProgressRing,
  Screen,
  SectionLabel,
  SegmentedControl,
  Sheet,
  Skeleton,
  Sparkline,
  StatTile,
  StatusPill,
  Stepper,
  Text,
  TextField,
  TimePickerSheet,
  ToastView,
  TodaySkeleton,
  WorkCheckRow,
} from '@/components';
import { t } from '@/copy/en';
import { buildSample } from '@/dev/sampleData';
import { clockFromMinutes } from '@/lib/format';
import { ThemeProvider, space, type ColorScheme, useTheme } from '@/theme';

type Mode = 'both' | 'dark' | 'light';

export default function DevGallery() {
  const [mode, setMode] = useState<Mode>('both');
  if (!__DEV__) return <Redirect href="/" />;
  const schemes: ColorScheme[] = mode === 'both' ? ['dark', 'light'] : [mode];
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <Text variant="title1">Component gallery</Text>
        <SegmentedControl
          options={[
            { value: 'both', label: 'Both' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {schemes.map((s) => (
          <ThemeProvider key={s} forced={s}>
            <Gallery scheme={s} />
          </ThemeProvider>
        ))}
      </Screen>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

function Gallery({ scheme }: { scheme: ColorScheme }) {
  const { c, work } = useTheme();
  const sample = useMemo(() => buildSample(), []);
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [chips, setChips] = useState<number[]>([1]);
  const [step, setStep] = useState(60);
  const [checked, setChecked] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);
  const [time, setTime] = useState(23 * 60);
  const [text, setText] = useState('Quant');
  const s = sample.state;

  const overall = useMemo(
    () => [
      {
        key: 'o',
        color: c.accent,
        values: s.overallSeries.map((p) => p.value),
        markIndices: s.overallSeries
          .filter((p) => p.status === 'partial' || p.status === 'missed')
          .map((p) => p.index),
      },
      { key: 't', color: c.target, values: s.targetSeries.map((p) => p.value), dashed: true },
    ],
    [s, c],
  );
  const perWork = useMemo(
    () =>
      sample.works.map((w) => ({
        key: w.id,
        color: work(w.colorIndex),
        values: (s.perWorkSeries[w.id] ?? []).map((p) => p.value),
      })),
    [sample, s, work],
  );

  return (
    <View style={[styles.panel, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text variant="title2">{scheme === 'dark' ? 'Dark' : 'Light'}</Text>

      <Section title="Typography">
        <Text variant="display">112.4</Text>
        <Text variant="title1">Title 1</Text>
        <Text variant="title2">Title 2</Text>
        <Text variant="headline">Headline</Text>
        <Text variant="body">Body text, calm and direct.</Text>
        <Text variant="callout" tone="secondary">
          Callout, secondary
        </Text>
        <Text variant="subhead" tone="secondary">
          Subhead label
        </Text>
        <Text variant="caption" tone="tertiary">
          Caption, tertiary
        </Text>
      </Section>

      <Section title="Colors">
        <View style={styles.wrap}>
          {(['accent', 'growth', 'decline', 'caution', 'text', 'text2', 'text3'] as const).map(
            (k) => (
              <View key={k} style={styles.swatchRow}>
                <ColorDot color={c[k]} size={16} />
                <Text variant="caption" tone="secondary">
                  {k}
                </Text>
              </View>
            ),
          )}
        </View>
        <View style={styles.wrap}>
          {Array.from({ length: 8 }, (_, i) => (
            <ColorDot key={i} color={work(i)} size={20} />
          ))}
        </View>
      </Section>

      <Section title="Buttons">
        <Button label="Primary" onPress={() => undefined} />
        <Button label="Secondary" variant="secondary" onPress={() => undefined} />
        <Button label="Ghost" variant="ghost" onPress={() => undefined} />
        <Button label="Destructive" variant="destructive" onPress={() => undefined} />
        <Button label="Loading" loading />
        <Button label="Disabled" disabled />
        <View style={styles.row}>
          <IconButton icon={<Settings size={20} color={c.text} />} accessibilityLabel="Settings" />
          <IconButton
            icon={<X size={20} color={c.text} />}
            accessibilityLabel="Close"
            variant="filled"
          />
          <IconButton
            icon={<X size={20} color={c.text} />}
            accessibilityLabel="Disabled"
            disabled
          />
        </View>
      </Section>

      <Section title="Hold to confirm">
        <HoldToConfirmButton label={t.wizard.holdToLock} onConfirm={() => undefined} />
        <HoldToConfirmButton
          label="Hold to end plan"
          tone="destructive"
          onConfirm={() => undefined}
        />
        <HoldToConfirmButton label="Disabled" disabled onConfirm={() => undefined} />
      </Section>

      <Section title="Pills">
        <View style={styles.wrap}>
          <Pill label="Neutral" />
          <Pill label="Accent" tone="accent" />
          <Pill label="Completed" tone="growth" />
          <Pill label="Ended early" tone="decline" />
          <Pill label="Partial" tone="caution" />
        </View>
        <StatusPill label={t.today.pillBefore('9:00 PM', '3h 12m')} />
        <StatusPill label={t.today.pillOpen('1h 04m')} tone="accent" />
        <StatusPill label={t.today.pillOpen('24m')} tone="caution" />
        <StatusPill label={t.today.pillComplete(12)} tone="growth" />
        <StatusPill label={t.today.pillClosed(12, 3, 4)} tone="decline" />
        <StatusPill label={t.today.pillRest} />
        <StatusPill label={t.today.pillNotStartedTomorrow('9:00 PM')} />
      </Section>

      <Section title="Controls">
        <SegmentedControl
          options={[
            { value: 'a', label: 'Overall' },
            { value: 'b', label: 'Each work' },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <View style={styles.wrap}>
          {['Mon', 'Tue', 'Wed', 'Sun'].map((d, i) => (
            <Chip
              key={d}
              label={d}
              selected={chips.includes(i)}
              onPress={() =>
                setChips((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))
              }
            />
          ))}
          <Chip label="Disabled" selected={false} disabled onPress={() => undefined} />
        </View>
        <Stepper
          value={step}
          min={30}
          max={90}
          onChange={setStep}
          accessibilityLabel="Duration"
          format={(v) => `${v} days`}
        />
        <Button
          label={`Time picker: ${clockFromMinutes(time)}`}
          variant="secondary"
          onPress={() => setTimeSheet(true)}
        />
        <TextField label="Work title" value={text} onChangeText={setText} maxLength={40} counter />
        <TextField
          label="With error"
          value=""
          placeholder="you@example.com"
          error={t.auth.emailInvalid}
        />
      </Section>

      <Section title="Work rows">
        <Card>
          <WorkCheckRow
            title="Static GK"
            criteria="1 chapter + 20 MCQs"
            colorIndex={0}
            score={118.3}
            lastDelta={0.02}
            checked={checked}
            locked={false}
            onPress={() => setChecked((v) => !v)}
          />
          <WorkCheckRow
            title="English reading"
            criteria={null}
            colorIndex={1}
            score={104.1}
            lastDelta={-0.02}
            checked
            locked={false}
            onPress={() => undefined}
          />
          <WorkCheckRow
            title="Reasoning"
            criteria="1 sectional test"
            colorIndex={2}
            score={99.2}
            lastDelta={null}
            checked={false}
            locked
            onPress={() => undefined}
          />
          <WorkCheckRow
            title="Quant"
            criteria="30 questions, timed"
            colorIndex={3}
            score={92.7}
            lastDelta={-0.02}
            checked={false}
            locked={false}
            pending
            onPress={() => undefined}
            isLast
          />
        </Card>
      </Section>

      <Section title="Progress, deltas, stats">
        <View style={styles.row}>
          <ProgressRing progress={0} />
          <ProgressRing progress={0.5} />
          <ProgressRing progress={1} color={c.growth} />
        </View>
        <View style={styles.row}>
          <DeltaBadge delta={0.02} />
          <DeltaBadge delta={-0.02} />
          <DeltaBadge delta={0} />
          <DeltaBadge delta={null} />
          <DeltaBadge delta={0.01} size="sm" bare />
        </View>
        <View style={styles.row}>
          <StatTile label="Current score" value="112.4" />
          <StatTile label="Gap" value="−2.9%" valueColor={c.decline} />
        </View>
      </Section>

      <Section title="Charts">
        <Card size="lg">
          <LineChart
            series={overall}
            accessibilityLabel="Sample overall chart"
            renderTooltip={(i) => <Text variant="caption">{`Day ${i}`}</Text>}
          />
        </Card>
        <Card size="lg">
          <LineChart series={perWork} accessibilityLabel="Sample per-work chart" height={180} />
        </Card>
        <Card>
          <Sparkline values={overall[0]?.values ?? []} target={overall[1]?.values} />
        </Card>
        <Card size="lg">
          <HeatmapCalendar days={s.days} />
        </Card>
      </Section>

      <Section title="Feedback">
        <ToastView inline item={{ id: 1, message: 'Check-in opens 9:00 PM', tone: 'neutral' }} />
        <ToastView inline item={{ id: 2, message: 'Day 12 complete', tone: 'growth' }} />
        <ToastView
          inline
          item={{ id: 3, message: 'The check-in window is closed.', tone: 'decline' }}
        />
        <OfflineBanner message={t.offline} />
        <EmptyState
          title={t.today.noPlanTitle}
          body={t.today.noPlanBody}
          actionLabel={t.today.noPlanCta}
          onAction={() => undefined}
        />
        <ErrorState
          message={t.errors.loadFailed}
          retryLabel={t.common.retry}
          onRetry={() => undefined}
        />
        <Button label="Open sheet" variant="secondary" onPress={() => setSheet(true)} />
      </Section>

      <Section title="Lists">
        <Card>
          <ListRow label="Plan details" onPress={() => undefined} />
          <ListRow label="Version" value="0.1.0" />
          <ListRow label="Delete account" tone="destructive" onPress={() => undefined} isLast />
        </Card>
      </Section>

      <Section title="Skeletons">
        <Skeleton width={180} />
        <TodaySkeleton />
      </Section>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={t.plan.endEarly}>
        <Text variant="body" tone="secondary">
          {t.plan.endEarlyBody}
        </Text>
        <Button label={t.common.close} variant="secondary" onPress={() => setSheet(false)} />
      </Sheet>
      <TimePickerSheet
        visible={timeSheet}
        value={time}
        onChange={setTime}
        onClose={() => setTimeSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.xl,
    padding: space.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  swatchRow: { flexDirection: 'row', gap: space.xxs, alignItems: 'center', marginRight: space.sm },
});
