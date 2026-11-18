/* eslint-disable react-hooks/refs --
 * PanResponder handlers read the latest props through refs. They run only in
 * gesture callbacks, never during render, which this rule cannot see. */
import { GripVertical, Plus, X } from 'lucide-react-native';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type PanResponderInstance } from 'react-native';
import { Button, ColorDot, IconButton, Text, TextField } from '@/components';
import { t } from '@/copy/en';
import { MAX_WORKS } from '@/domain/time';
import { haptics } from '@/lib/haptics';
import { radius, space, touchTarget, useTheme } from '@/theme';

export interface DraftWork {
  key: string;
  title: string;
  criteria: string;
}

interface Props {
  works: DraftWork[];
  onChange: (works: DraftWork[]) => void;
  /** Called with true while a row is being dragged (so the parent can lock scrolling). */
  onDragging: (dragging: boolean) => void;
}

let seq = 0;
export function newDraftWork(title = '', criteria = ''): DraftWork {
  seq += 1;
  return { key: `w${Date.now()}-${seq}`, title, criteria };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * 1–8 work rows. Reorder by holding the grip and dragging; screen readers get
 * "Move up" / "Move down" actions on each row instead.
 */
export function WorkListEditor({ works, onChange, onDragging }: Props) {
  const { c, work } = useTheme();
  const heights = useRef<number[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dy = useRef(new Animated.Value(0)).current;
  // Responders must be stable across renders or gesture state resets mid-drag,
  // so they read the latest props through refs.
  const latest = useRef({ works, onChange, onDragging });
  useLayoutEffect(() => {
    latest.current = { works, onChange, onDragging };
  });

  const update = (i: number, patch: Partial<DraftWork>) =>
    onChange(works.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  const targetIndex = (from: number, offset: number): number => {
    let to = from;
    let acc = 0;
    if (offset > 0) {
      for (let j = from + 1; j < latest.current.works.length; j += 1) {
        const h = heights.current[j] ?? 120;
        if (offset > acc + h / 2) {
          to = j;
          acc += h;
        } else break;
      }
    } else {
      for (let j = from - 1; j >= 0; j -= 1) {
        const h = heights.current[j] ?? 120;
        if (-offset > acc + h / 2) {
          to = j;
          acc += h;
        } else break;
      }
    }
    return to;
  };

  const count = works.length;
  const responders = useMemo<PanResponderInstance[]>(
    () =>
      Array.from({ length: count }, (_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            haptics.light();
            dy.setValue(0);
            latest.current.onDragging(true);
            setDrag({ from: index, to: index });
          },
          onPanResponderMove: (_e, g) => {
            dy.setValue(g.dy);
            const to = targetIndex(index, g.dy);
            setDrag((d) => {
              if (d && d.to !== to) haptics.selection();
              return d && d.to !== to ? { ...d, to } : d;
            });
          },
          onPanResponderRelease: (_e, g) => {
            const to = targetIndex(index, g.dy);
            latest.current.onDragging(false);
            setDrag(null);
            dy.setValue(0);
            if (to !== index) latest.current.onChange(move(latest.current.works, index, to));
          },
          onPanResponderTerminate: () => {
            latest.current.onDragging(false);
            setDrag(null);
            dy.setValue(0);
          },
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count],
  );

  return (
    <View style={styles.list}>
      {works.map((w, i) => {
        const dragging = drag?.from === i;
        const showIndicatorBefore = drag && drag.to === i && drag.to < drag.from;
        const showIndicatorAfter = drag && drag.to === i && drag.to > drag.from;
        return (
          <View key={w.key}>
            {showIndicatorBefore ? (
              <View style={[styles.indicator, { backgroundColor: c.accent }]} />
            ) : null}
            <Animated.View
              onLayout={(e) => {
                heights.current[i] = e.nativeEvent.layout.height + space.sm;
              }}
              accessible={false}
              accessibilityActions={[
                { name: 'moveUp', label: t.wizard.moveUp },
                { name: 'moveDown', label: t.wizard.moveDown },
              ]}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'moveUp' && i > 0) onChange(move(works, i, i - 1));
                if (e.nativeEvent.actionName === 'moveDown' && i < works.length - 1)
                  onChange(move(works, i, i + 1));
              }}
              style={[
                styles.row,
                {
                  backgroundColor: c.surface,
                  borderColor: dragging ? c.accent : c.border,
                  zIndex: dragging ? 10 : 0,
                  transform: dragging ? [{ translateY: dy }] : [],
                  shadowOpacity: dragging ? 0.2 : 0,
                },
              ]}
            >
              <View style={styles.head}>
                <View
                  {...responders[i]?.panHandlers}
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel={`${t.wizard.dragHint}. ${w.title || t.wizard.workTitlePlaceholder(i + 1)}`}
                  accessibilityActions={[
                    { name: 'increment', label: t.wizard.moveDown },
                    { name: 'decrement', label: t.wizard.moveUp },
                  ]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'decrement' && i > 0)
                      onChange(move(works, i, i - 1));
                    if (e.nativeEvent.actionName === 'increment' && i < works.length - 1)
                      onChange(move(works, i, i + 1));
                  }}
                  style={styles.grip}
                  hitSlop={8}
                >
                  <GripVertical size={18} color={c.text3} />
                </View>
                <ColorDot color={work(i)} />
                <Text variant="subhead" tone="secondary" style={styles.flex}>
                  {`Work ${i + 1}`}
                </Text>
                {works.length > 1 ? (
                  <IconButton
                    accessibilityLabel={t.wizard.removeWork(w.title)}
                    icon={<X size={18} color={c.text3} />}
                    onPress={() => onChange(works.filter((_, j) => j !== i))}
                    size={36}
                  />
                ) : null}
              </View>
              <TextField
                value={w.title}
                onChangeText={(v) => update(i, { title: v })}
                placeholder={t.wizard.workTitlePlaceholder(i + 1)}
                maxLength={40}
                accessibilityLabel={`Work ${i + 1} title`}
                returnKeyType="next"
                autoCapitalize="sentences"
              />
              <TextField
                value={w.criteria}
                onChangeText={(v) => update(i, { criteria: v })}
                placeholder={t.wizard.workCriteriaPlaceholder}
                maxLength={120}
                counter={w.criteria.length > 90}
                accessibilityLabel={`Work ${i + 1}: what counts as done`}
                multiline
                style={styles.criteria}
              />
            </Animated.View>
            {showIndicatorAfter ? (
              <View style={[styles.indicator, { backgroundColor: c.accent }]} />
            ) : null}
          </View>
        );
      })}
      {works.length < MAX_WORKS ? (
        <Button
          label={t.wizard.addWork}
          variant="secondary"
          icon={<Plus size={18} color={c.text} />}
          onPress={() => onChange([...works, newDraftWork()])}
        />
      ) : (
        <Text variant="callout" tone="tertiary">
          {t.wizard.maxWorks}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.sm },
  row: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.sm,
    gap: space.xs,
    shadowColor: '#000',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grip: {
    width: touchTarget - 8,
    height: touchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.xs,
  },
  criteria: { minHeight: 48, fontSize: 15 },
  indicator: { height: 2, borderRadius: 1, marginVertical: -1 },
});
