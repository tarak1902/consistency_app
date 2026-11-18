import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, screenPadding, space, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Declarative wrapper around @gorhom/bottom-sheet's modal. Sizes to content. */
export function Sheet({ visible, onClose, title, children }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enableDynamicSizing
      backdropComponent={backdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      animateOnMount={!reduce}
      backgroundStyle={{ backgroundColor: c.surface, borderRadius: radius.sheet }}
      handleIndicatorStyle={{ backgroundColor: c.border, width: 36 }}
      accessibilityLabel={title}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: insets.bottom + space.lg }]}>
        {title ? (
          <Text variant="title2" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: screenPadding, paddingTop: space.xs, gap: space.md },
});
