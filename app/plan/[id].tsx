import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  ChartSkeleton,
  ColorDot,
  ErrorState,
  ListRow,
  Pill,
  Screen,
  SectionLabel,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { errorMessage } from '@/data/errors';
import { useEndPlanEarly } from '@/data/mutations';
import { PlanVisuals } from '@/features/plan/PlanVisuals';
import { usePlanComputed } from '@/features/plan/usePlanComputed';
import { clockFromMinutes, clockTime, dateRange, rateLabel, weekdayName } from '@/lib/format';
import { parseSleepTime, planWindow } from '@/domain/time';
import { haptics } from '@/lib/haptics';
import { space, useTheme } from '@/theme';

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, work } = useTheme();
  const toast = useToast();
  const { bundle, state, isLoading, isError, refetch } = usePlanComputed(id);
  const end = useEndPlanEarly();
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState('');

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t.plan.detailsTitle} />
        <ChartSkeleton />
      </Screen>
    );
  }
  if (isError || !bundle || !state) {
    return (
      <Screen>
        <ScreenHeader title={t.plan.detailsTitle} />
        <ErrorState message={t.errors.loadFailed} retryLabel={t.common.retry} onRetry={refetch} />
      </Screen>
    );
  }

  const { plan, works } = bundle;
  const status = state.effectiveStatus;
  const isActive = status === 'active';
  const w = planWindow(plan.startDate, plan);

  const doEnd = () => {
    end.mutate(
      { planId: plan.id, confirm: confirm.trim() },
      {
        onSuccess: () => {
          haptics.success();
          setSheet(false);
          toast.show(t.plan.endedToast);
          router.replace({ pathname: '/results/[id]', params: { id: plan.id } });
        },
        onError: (e) => {
          haptics.warning();
          toast.show(errorMessage(e, plan.timezone), 'decline');
        },
      },
    );
  };

  return (
    <Screen>
      <ScreenHeader eyebrow={dateRange(plan.startDate, plan.endDate)} title={t.plan.detailsTitle} />
      <Pill
        size="md"
        label={
          isActive
            ? t.history.active
            : status === 'ended_early'
              ? t.history.endedEarly
              : t.history.completed
        }
        tone={isActive ? 'accent' : status === 'ended_early' ? 'decline' : 'growth'}
      />

      <PlanVisuals planId={plan.id} works={works} state={state} />

      <View style={styles.section}>
        <SectionLabel>{t.wizard.labels.works}</SectionLabel>
        <Card>
          {works.map((wk, i) => (
            <View
              key={wk.id}
              style={[
                styles.workRow,
                i < works.length - 1 && {
                  borderBottomColor: c.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <ColorDot color={work(wk.colorIndex)} />
              <View style={styles.flex}>
                <Text variant="headline">{wk.title}</Text>
                {wk.doneCriteria ? (
                  <Text variant="callout" tone="secondary">
                    {wk.doneCriteria}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t.plan.lockedNote}</SectionLabel>
        <Card>
          <ListRow
            label={t.wizard.labels.rate}
            value={`${rateLabel(plan.rate)} ${t.wizard.rateNames[String(plan.rate)] ?? ''}`}
          />
          <ListRow label={t.wizard.labels.duration} value={t.common.days(plan.durationDays)} />
          <ListRow label={t.wizard.labels.dates} value={dateRange(plan.startDate, plan.endDate)} />
          <ListRow
            label={t.wizard.labels.rest}
            value={
              plan.restWeekdays.length
                ? plan.restWeekdays.map((d) => weekdayName(d)).join(', ')
                : t.wizard.restNone
            }
          />
          <ListRow
            label={t.wizard.labels.sleep}
            value={clockFromMinutes(parseSleepTime(plan.sleepTime))}
          />
          <ListRow
            label={t.wizard.labels.window}
            value={`${clockTime(w.open, plan.timezone)} – ${clockTime(w.close, plan.timezone)}`}
          />
          <ListRow label={t.wizard.labels.timezone} value={plan.timezone} isLast />
        </Card>
      </View>

      {isActive ? (
        <View style={styles.section}>
          <SectionLabel>{t.plan.dangerZone}</SectionLabel>
          <Card>
            <Text variant="callout" tone="secondary">
              {t.plan.endEarlyBody}
            </Text>
            <Button
              label={t.plan.endEarly}
              variant="destructive"
              onPress={() => {
                setConfirm('');
                setSheet(true);
              }}
              style={styles.top}
            />
          </Card>
        </View>
      ) : (
        <View style={styles.section}>
          <Button
            label={t.results.title}
            variant="secondary"
            onPress={() => router.push({ pathname: '/results/[id]', params: { id: plan.id } })}
          />
          <Button
            label={t.history.startNewFrom}
            onPress={() => router.push({ pathname: '/plan/new', params: { from: plan.id } })}
          />
        </View>
      )}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={t.plan.endEarly}>
        <Text variant="body" tone="secondary">
          {t.plan.endEarlyBody}
        </Text>
        <TextField
          label={t.plan.endEarlyPrompt}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="END"
        />
        <Button
          label={t.plan.endEarlyConfirm}
          variant="destructive"
          disabled={confirm.trim() !== 'END'}
          loading={end.isPending}
          onPress={doEnd}
        />
        <Button label={t.common.cancel} variant="ghost" onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space.xs },
  top: { marginTop: space.md },
  workRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.sm,
    alignItems: 'flex-start',
  },
});
