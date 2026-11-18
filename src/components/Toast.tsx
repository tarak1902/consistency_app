import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

export type ToastTone = 'neutral' | 'growth' | 'decline' | 'caution';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = 'neutral') => {
    seq.current += 1;
    setItem({ id: seq.current, message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setItem(null), 2800);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastView item={item} />
    </ToastContext.Provider>
  );
}

export function ToastView({ item, inline }: { item: ToastItem | null; inline?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  if (!item) return null;
  const dot: Record<ToastTone, string> = {
    neutral: c.accent,
    growth: c.growth,
    decline: c.decline,
    caution: c.caution,
  };
  return (
    <View
      pointerEvents="none"
      style={inline ? null : [styles.host, { bottom: insets.bottom + 72 }]}
    >
      <Animated.View
        key={item.id}
        entering={reduce ? undefined : FadeInDown.duration(220)}
        exiting={reduce ? undefined : FadeOutDown.duration(180)}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: c.text, shadowColor: '#000' }]}
      >
        <View style={[styles.dot, { backgroundColor: dot[item.tone] }]} />
        <Text variant="callout" color={c.bg} style={styles.text}>
          {item.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    maxWidth: 480,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { flexShrink: 1 },
});
