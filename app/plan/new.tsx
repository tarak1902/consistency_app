import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import {
  Button,
  Card,
  Chip,
  ColorDot,
  HoldToConfirmButton,
  ListRow,
  ProgressRing,
  Screen,
  SectionLabel,
  Stepper,
  Text,
  TimePickerSheet,
  useToast,
} from '@/components';
import { CompoundCurves } from '@/components/CompoundCurves';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { errorMessage } from '@/data/errors';
import { useCreatePlan } from '@/data/mutations';
import { useCurrentPlan, usePlans } from '@/data/queries';
import { activeDayCount, effectiveStatus, referenceMultipliers } from '@/domain/scoring';
import {
  MAX_DURATION,
  MAX_REST_DAYS,
  MIN_DURATION,
  RATES,
  deviceTimeZone,
  endDateFor,
  formatSleepTime,
  localDateAt,
  planWindow,
  startDateFor,
  type Rate,
} from '@/domain/time';
import { newDraftWork, WorkListEditor, type DraftWork } from '@/features/wizard/WorkListEditor';
import {
  clockFromMinutes,
  clockTime,
  fullDate,
  listJoin,
  mediumDate,
  multiplier,
  rateLabel,
  weekdayName,
} from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { requestPermission } from '@/lib/notifications';
import { serverNow } from '@/lib/serverClock';
import { radius, space, useTheme } from '@/theme';

const STEPS = 6;
const DURATION_PRESETS = [30, 60, 90] as const;

type Done = { startDate: string; firstOpen: number; tz: string };

export default function NewPlanWizard() {
  const { c, work } = useTheme();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const plans = usePlans();
  const current = useCurrentPlan();
  const create = useCreatePlan();

  const prefill = useMemo(
    () => plans.data?.find((b) => b.plan.id === from) ?? null,
    [plans.data, from],
  );

  const [step, setStep] = useState(0);
  const [works, setWorks] = useState<DraftWork[]>(() => [newDraftWork()]);
  const [prefilled, setPrefilled] = useState(false);
  const [rate, setRate] = useState<Rate>(0.01);
  const [duration, setDuration] = useState(60);
  const [rest, setRest] = useState<number[]>([]);
  const [sleep, setSleep] = useState(23 * 60);
  const [timeSheet, setTimeSheet] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [notifAsked, setNotifAsked] = useState(false);
  const tz = useMemo(() => deviceTimeZone(), []);

  // Pre-fill works from a previous plan (adjusting state during render, once).
  if (prefill && !prefilled) {
    setPrefilled(true);
    setWorks(prefill.works.map((w) => newDraftWork(w.title, w.doneCriteria ?? '')));
  }

  const sleepStr = formatSleepTime(sleep);
  const config = { sleepTime: sleepStr, timezone: tz, restWeekdays: rest };
  const now = serverNow();
  const startDate = startDateFor(now, config);
  const endDate = endDateFor(startDate, duration);
  const activeDays = activeDayCount({ startDate, endDate, restWeekdays: rest });
  const window = planWindow(startDate, config);

  const cleanWorks = works
    .map((w) => ({ title: w.title.trim(), done_criteria: w.criteria.trim() || null }))
    .filter((w) => w.title.length > 0 || w.done_criteria !== null);
  const worksValid =
    cleanWorks.length >= 1 && cleanWorks.every((w) => w.title.length >= 1 && w.title.length <= 40);

  const activeBlocking =
    current.bundle && effectiveStatus(current.bundle.plan, now) === 'active' && !done;

  const back = () => {
    if (step === 0) router.back();
    else setStep(step - 1);
  };
  const next = () => {
    haptics.selection();
    setStep(Math.min(STEPS - 1, step + 1));
  };

  const toggleRest = (d: number) => {
    if (rest.includes(d)) {
      setRest(rest.filter((x) => x !== d));
      return;
    }
    if (rest.length >= MAX_REST_DAYS) {
      haptics.warning();
      toast.show(t.wizard.restMax, 'caution');
      return;
    }
    setRest([...rest, d].sort());
  };

  const lock = () => {
    create.mutate(
      {
        rate,
        durationDays: duration,
        restWeekdays: rest,
        sleepTime: sleepStr,
        timezone: tz,
        works: cleanWorks,
      },
      {
        onSuccess: () => {
          haptics.success();
          const at = serverNow();
          const s = startDateFor(at, config);
          setDone({ startDate: s, firstOpen: planWindow(s, config).open, tz });
        },
        onError: (e) => {
          haptics.warning();
          toast.show(errorMessage(e, tz), 'decline');
        },
      },
    );
  };

  if (activeBlocking) {
    return (
      <Screen>
        <ScreenHeader leading="close" />
        <Card size="lg">
          <Text variant="title2">{t.errors.ACTIVE_PLAN_EXISTS}</Text>
        </Card>
      </Screen>
    );
  }

  if (done) {
    const today = localDateAt(serverNow(), done.tz);
    const startsLabel =
      done.startDate === today
        ? t.wizard.startsToday
        : t.wizard.startsOn(mediumDate(done.startDate));
    return (
      <Screen
        footer={
          <View style={{ gap: space.sm }}>
            {!notifAsked ? (
              <>
                <Button
                  label={t.wizard.notifAllow}
                  onPress={() => {
                    setNotifAsked(true);
                    requestPermission().catch(() => undefined);
                  }}
                />
                <Button
                  label={t.wizard.notifLater}
                  variant="ghost"
                  onPress={() => {
                    setNotifAsked(true);
                    router.replace('/today');
                  }}
                />
              </>
            ) : (
              <Button label={t.wizard.goToToday} onPress={() => router.replace('/today')} />
            )}
          </View>
        }
      >
        <Animated.View entering={reduce ? undefined : FadeIn.duration(280)} style={styles.done}>
          <ProgressRing progress={1} size={88} stroke={6} color={c.growth}>
            <Check size={36} color={c.growth} strokeWidth={2.5} />
          </ProgressRing>
          <Text variant="title1" align="center">
            {t.wizard.locked}
          </Text>
          <Text variant="headline" align="center">
            {done.startDate === today ? t.wizard.startsToday : startsLabel}
          </Text>
          <Text variant="body" tone="secondary" align="center">
            {t.wizard.firstWindow(clockTime(done.firstOpen, done.tz))}
          </Text>
          {!notifAsked ? (
            <Card style={styles.fullWidth}>
              <Text variant="body">{t.wizard.notifAsk}</Text>
            </Card>
          ) : null}
        </Animated.View>
      </Screen>
    );
  }

  const canContinue = step === 0 ? worksValid : true;

  const footer =
    step < STEPS - 1 ? (
      <Button label={t.common.continue} onPress={next} disabled={!canContinue} />
    ) : (
      <HoldToConfirmButton
        label={t.wizard.holdToLock}
        onConfirm={lock}
        loading={create.isPending}
      />
    );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen footer={footer} scrollEnabled={!dragging}>
        <ScreenHeader leading={step === 0 ? 'close' : 'back'} onLeading={back} />
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t.wizard.stepOf(step + 1, STEPS)}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={[styles.progressSeg, { backgroundColor: i <= step ? c.accent : c.border }]}
            />
          ))}
        </View>
        <Text variant="subhead" tone="secondary">
          {t.wizard.stepOf(step + 1, STEPS)}
        </Text>

        {step === 0 ? (
          <>
            <Text variant="title1" accessibilityRole="header">
              {t.wizard.worksTitle}
            </Text>
            <Text variant="body" tone="secondary">
              {t.wizard.worksBody}
            </Text>
            {prefill ? (
              <Text variant="callout" tone="accent">
                {t.wizard.prefilled}
              </Text>
            ) : null}
            <WorkListEditor works={works} onChange={setWorks} onDragging={setDragging} />
            {works.length > 1 ? (
              <Text variant="caption" tone="tertiary">
                {t.wizard.dragHint}
              </Text>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text variant="title1" accessibilityRole="header">
              {t.wizard.rateTitle}
            </Text>
            <Text variant="body" tone="secondary">
              {t.wizard.rateBody}
            </Text>
            <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
              {RATES.map((r) => {
                const m = referenceMultipliers(r, activeDays);
                const selected = r === rate;
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${rateLabel(r)} ${t.wizard.rateNames[String(r)]}. ${t.wizard.ratePerfect(multiplier(m.perfect), activeDays)}. ${t.wizard.ratePenalty(rateLabel(r))}`}
                    onPress={() => {
                      haptics.selection();
                      setRate(r);
                    }}
                    style={[
                      styles.rateCard,
                      {
                        borderColor: selected ? c.accent : c.border,
                        backgroundColor: selected ? c.accentSoft : c.surface,
                      },
                    ]}
                  >
                    <View style={styles.rateHead}>
                      <Text variant="title1" numeric color={selected ? c.accent : c.text}>
                        {rateLabel(r)}
                      </Text>
                      <Text variant="headline" color={selected ? c.accent : c.text}>
                        {t.wizard.rateNames[String(r)]}
                      </Text>
                    </View>
                    <Text variant="callout" numeric>
                      {t.wizard.ratePerfect(multiplier(m.perfect), activeDays)}
                    </Text>
                    <Text variant="callout" tone="secondary">
                      {t.wizard.ratePenalty(rateLabel(r))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Card>
              <CompoundCurves
                key={rate}
                curves={[
                  {
                    values: Array.from({ length: activeDays + 1 }, (_, i) => Math.pow(1 + rate, i)),
                    color: c.growth,
                  },
                  {
                    values: Array.from({ length: activeDays + 1 }, (_, i) => Math.pow(1 - rate, i)),
                    color: c.decline,
                  },
                ]}
                baseline={1}
                height={120}
              />
              <View style={styles.between}>
                <Text variant="caption" tone="decline" numeric>
                  {`${multiplier(referenceMultipliers(rate, activeDays).missed)} all missed`}
                </Text>
                <Text variant="caption" tone="growth" numeric>
                  {`${multiplier(referenceMultipliers(rate, activeDays).perfect)} all done`}
                </Text>
              </View>
            </Card>
            <Text variant="callout" tone="secondary">
              {t.wizard.rateCap}
            </Text>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text variant="title1" accessibilityRole="header">
              {t.wizard.durationTitle}
            </Text>
            <Text variant="body" tone="secondary">
              {t.wizard.durationBody}
            </Text>
            <View style={styles.chips}>
              {DURATION_PRESETS.map((d) => (
                <Chip
                  key={d}
                  label={t.common.days(d)}
                  selected={duration === d}
                  onPress={() => setDuration(d)}
                />
              ))}
            </View>
            <SectionLabel>{t.wizard.durationCustom}</SectionLabel>
            <Stepper
              value={duration}
              min={MIN_DURATION}
              max={MAX_DURATION}
              onChange={setDuration}
              format={(v) => t.common.days(v)}
              accessibilityLabel={t.wizard.durationTitle}
            />
            <Card>
              <Text variant="headline">{t.wizard.durationEnds(fullDate(endDate))}</Text>
              <Text variant="callout" tone="secondary">
                {`${mediumDate(startDate)} – ${mediumDate(endDate)}`}
              </Text>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text variant="title1" accessibilityRole="header">
              {t.wizard.restTitle}
            </Text>
            <Text variant="body" tone="secondary">
              {t.wizard.restBody}
            </Text>
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Chip
                  key={d}
                  label={weekdayName(d)}
                  accessibilityLabel={weekdayName(d, true)}
                  selected={rest.includes(d)}
                  onPress={() => toggleRest(d)}
                  style={styles.weekday}
                />
              ))}
            </View>
            <Text variant="callout" tone="secondary" numeric>
              {rest.length === 0
                ? t.wizard.restNone
                : `${listJoin(rest.map((d) => weekdayName(d, true)))} ${'·'} ${t.common.days(activeDays)} active`}
            </Text>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text variant="title1" accessibilityRole="header">
              {t.wizard.sleepTitle}
            </Text>
            <Card size="lg">
              <Text variant="subhead" tone="secondary">
                {t.wizard.labels.window}
              </Text>
              <Text variant="title1" numeric style={{ marginTop: space.xs }}>
                {`${clockFromMinutes((sleep + 22 * 60) % 1440)} – ${clockFromMinutes(sleep)}`}
              </Text>
              <Text variant="callout" tone="secondary">
                {t.wizard.sleepEveryDay}
              </Text>
            </Card>
            <Button
              label={`${t.wizard.sleepTitle}: ${clockFromMinutes(sleep)}`}
              variant="secondary"
              icon={<Clock size={18} color={c.text} />}
              onPress={() => setTimeSheet(true)}
              accessibilityHint={t.wizard.sleepChange}
            />
            <Text variant="body" tone="secondary">
              {t.wizard.sleepBody}
            </Text>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Text variant="title1" accessibilityRole="header">
              {t.wizard.reviewTitle}
            </Text>
            <Card>
              <SectionLabel>{t.wizard.labels.works}</SectionLabel>
              {cleanWorks.map((w, i) => (
                <View key={i} style={styles.reviewWork}>
                  <ColorDot color={work(i)} />
                  <View style={styles.flex}>
                    <Text variant="headline">{w.title}</Text>
                    {w.done_criteria ? (
                      <Text variant="callout" tone="secondary">
                        {w.done_criteria}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
            <Card>
              <ListRow
                label={t.wizard.labels.rate}
                value={`${rateLabel(rate)} ${t.wizard.rateNames[String(rate)]}`}
              />
              <ListRow label={t.wizard.labels.duration} value={t.common.days(duration)} />
              <ListRow
                label={t.wizard.labels.dates}
                value={`${mediumDate(startDate)} – ${mediumDate(endDate)}`}
              />
              <ListRow
                label={t.wizard.labels.rest}
                value={rest.length ? rest.map((d) => weekdayName(d)).join(', ') : t.wizard.restNone}
              />
              <ListRow label={t.wizard.labels.sleep} value={clockFromMinutes(sleep)} />
              <ListRow
                label={t.wizard.labels.window}
                value={`${clockTime(window.open, tz)} – ${clockTime(window.close, tz)}`}
              />
              <ListRow label={t.wizard.labels.timezone} value={tz} isLast />
            </Card>
            <View
              style={[styles.warning, { backgroundColor: c.cautionSoft, borderColor: c.caution }]}
            >
              <Text variant="callout">{t.wizard.reviewWarning(duration)}</Text>
            </View>
          </>
        ) : null}
      </Screen>
      <TimePickerSheet
        visible={timeSheet}
        value={sleep}
        onChange={setSleep}
        onClose={() => setTimeSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { flexDirection: 'row', gap: space.xxs },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  weekday: { minWidth: 64 },
  rateCard: { borderWidth: 1.5, borderRadius: radius.large, padding: space.md, gap: space.xxs },
  rateHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  reviewWork: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    paddingVertical: space.xs,
  },
  warning: { borderRadius: radius.card, borderWidth: 1, padding: space.md },
  done: { alignItems: 'center', gap: space.md, paddingTop: space.huge },
  fullWidth: { alignSelf: 'stretch' },
});
