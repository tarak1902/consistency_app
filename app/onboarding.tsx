import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { Button, Card, ColorDot, Text } from '@/components';
import { CompoundCurves } from '@/components/CompoundCurves';
import { t } from '@/copy/en';
import { useAuth } from '@/data/auth';
import { referenceMultipliers } from '@/domain/scoring';
import { DOWN, UP, multiplier } from '@/lib/format';
import { screenPadding, space, useTheme } from '@/theme';

const DAYS = 90;

function series(rate: number, days: number): number[] {
  return Array.from({ length: days + 1 }, (_, i) => Math.pow(1 + rate, i));
}

function Slide1() {
  const { c } = useTheme();
  const m = referenceMultipliers(0.01, DAYS);
  const curves = useMemo(
    () => [
      { values: series(0.01, DAYS), color: c.growth },
      { values: series(-0.01, DAYS), color: c.decline },
    ],
    [c],
  );
  return (
    <View style={styles.slide}>
      <Card size="lg" style={styles.visual}>
        <View style={styles.legendRow}>
          <Text variant="callout" tone="growth" numeric>
            {`${UP} ${t.onboarding.s1Better}  ${multiplier(m.perfect)}`}
          </Text>
          <Text variant="callout" tone="decline" numeric>
            {`${DOWN} ${t.onboarding.s1Worse}  ${multiplier(m.missed)}`}
          </Text>
        </View>
        <CompoundCurves curves={curves} baseline={1} height={180} />
        <View style={styles.axis}>
          <Text variant="caption" tone="tertiary">
            Day 1
          </Text>
          <Text variant="caption" tone="tertiary">
            Day 90
          </Text>
        </View>
      </Card>
      <Text variant="title1">{t.onboarding.s1Title}</Text>
      <Text variant="body" tone="secondary">
        {t.onboarding.s1Body(multiplier(m.perfect), multiplier(m.missed))}
      </Text>
    </View>
  );
}

function Slide2() {
  const { c, work } = useTheme();
  const items = ['Static GK', 'English reading', 'Reasoning', 'Quant'];
  return (
    <View style={styles.slide}>
      <Card size="lg" style={styles.visual}>
        {items.map((title, i) => (
          <View key={title} style={styles.lockRow}>
            <ColorDot color={work(i)} />
            <Text variant="headline" style={styles.flex}>
              {title}
            </Text>
            <Lock size={16} color={c.text3} />
          </View>
        ))}
        <Text variant="caption" tone="tertiary">
          Locked for 60 days
        </Text>
      </Card>
      <Text variant="title1">{t.onboarding.s2Title}</Text>
      <Text variant="body" tone="secondary">
        {t.onboarding.s2Body}
      </Text>
    </View>
  );
}

function Slide3() {
  const { c, work } = useTheme();
  const curves = useMemo(() => {
    const len = 12;
    const up = (k: number) => Array.from({ length: len }, (_, i) => 100 + i * (1.6 + k * 0.4));
    return [
      { values: up(0), color: work(0), width: 1.5 },
      { values: up(1), color: work(1), width: 1.5 },
      { values: up(2), color: work(2), width: 1.5 },
      { values: Array.from({ length: len }, (_, i) => 100 - i * 2.2), color: work(3), width: 1.5 },
      { values: Array.from({ length: len }, (_, i) => 100 - i * 1.4), color: c.accent, width: 3 },
    ];
  }, [c, work]);
  return (
    <View style={styles.slide}>
      <Card size="lg" style={styles.visual}>
        <CompoundCurves curves={curves} baseline={100} height={170} />
        <View style={styles.legendRow}>
          <Text variant="caption" tone="secondary">
            {`${UP} 3 works`}
          </Text>
          <Text variant="caption" tone="secondary">
            {`${DOWN} 1 work`}
          </Text>
          <Text variant="caption" tone="accent">
            {`${DOWN} Day score`}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary">
          {t.onboarding.s3Legend}
        </Text>
      </Card>
      <Text variant="title1">{t.onboarding.s3Title}</Text>
      <Text variant="body" tone="secondary">
        {t.onboarding.s3Body}
      </Text>
    </View>
  );
}

export default function Onboarding() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setOnboarded } = useAuth();
  const [page, setPage] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const slides = [Slide1, Slide2, Slide3];

  const finish = async () => {
    await setOnboarded();
    router.replace('/sign-in');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const next = () => {
    if (page >= slides.length - 1) {
      finish().catch(() => undefined);
      return;
    }
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Text variant="headline">{t.appName}</Text>
        {page < slides.length - 1 ? (
          <Button label={t.common.skip} variant="ghost" size="md" onPress={() => void finish()} />
        ) : (
          <View style={{ height: 44 }} />
        )}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.flex}
      >
        {slides.map((S, i) => (
          <View key={i} style={{ width, paddingHorizontal: screenPadding }}>
            <S />
          </View>
        ))}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${slides.length}`}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === page ? c.text : c.border, width: i === page ? 18 : 6 },
              ]}
            />
          ))}
        </View>
        <Button
          label={page === slides.length - 1 ? t.onboarding.cta : t.common.next}
          onPress={next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    minHeight: 52,
  },
  slide: { flex: 1, justifyContent: 'center', gap: space.md, paddingBottom: space.xl },
  visual: { gap: space.sm, marginBottom: space.lg },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  bottom: { paddingHorizontal: screenPadding, gap: space.lg },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 6, borderRadius: 3 },
});
