import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

interface Props {
  title?: string;
  eyebrow?: string;
  /** 'back' shows a chevron, 'close' an X (for modals). */
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  right?: ReactNode;
  large?: boolean;
}

export function ScreenHeader({
  title,
  eyebrow,
  leading = 'back',
  onLeading,
  right,
  large = true,
}: Props) {
  const { c } = useTheme();
  const goBack =
    onLeading ?? (() => (router.canGoBack() ? router.back() : router.replace('/today')));
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {leading !== 'none' ? (
          <IconButton
            accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
            icon={
              leading === 'close' ? (
                <X size={22} color={c.text} />
              ) : (
                <ChevronLeft size={24} color={c.text} />
              )
            }
            onPress={goBack}
            style={styles.lead}
          />
        ) : (
          <View />
        )}
        {right ?? <View />}
      </View>
      {title ? (
        <View style={styles.titles}>
          {eyebrow ? (
            <Text variant="subhead" tone="secondary">
              {eyebrow}
            </Text>
          ) : null}
          <Text variant={large ? 'title1' : 'title2'} accessibilityRole="header">
            {title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  lead: { marginLeft: -space.sm },
  titles: { gap: space.xxs },
});
