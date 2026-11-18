import { router } from 'expo-router';
import { useMemo } from 'react';
import { ChartSkeleton, EmptyState, ErrorState, OfflineBanner, Screen, Text } from '@/components';
import { t } from '@/copy/en';
import { useIsOffline } from '@/data/QueryProvider';
import { usePlans } from '@/data/queries';
import { PlanVisuals } from '@/features/plan/PlanVisuals';
import { usePlanComputed } from '@/features/plan/usePlanComputed';
import { DOT, dateRange } from '@/lib/format';

export default function ProgressScreen() {
  const offline = useIsOffline();
  const plans = usePlans();
  // The active plan, or the most recent one if none is active.
  const planId = useMemo(
    () => (plans.data?.find((b) => b.plan.status === 'active') ?? plans.data?.[0])?.plan.id,
    [plans.data],
  );
  const { bundle, state, isLoading, isError, refetch } = usePlanComputed(planId);
  const banner = offline ? <OfflineBanner message={t.offline} /> : null;

  return (
    <Screen banner={banner}>
      <Text variant="title1" accessibilityRole="header">
        {t.progress.title}
      </Text>
      {bundle ? (
        <Text variant="callout" tone="secondary" numeric>
          {`${dateRange(bundle.plan.startDate, bundle.plan.endDate)} ${DOT} ${Math.round(bundle.plan.rate * 100)}%`}
        </Text>
      ) : null}
      {isLoading ? (
        <ChartSkeleton />
      ) : isError ? (
        <ErrorState message={t.errors.loadFailed} retryLabel={t.common.retry} onRetry={refetch} />
      ) : bundle && state ? (
        <PlanVisuals planId={bundle.plan.id} works={bundle.works} state={state} />
      ) : (
        <EmptyState
          title={t.today.noPlanTitle}
          body={t.progress.noPlan}
          actionLabel={t.today.noPlanCta}
          onAction={() => router.push('/plan/new')}
        />
      )}
    </Screen>
  );
}
