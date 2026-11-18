import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  label: string;
  value: string;
  sub?: ReactNode;
  valueColor?: string;
}

export function StatTile({ label, value, sub, valueColor }: Props) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Text variant="subhead" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="title2" numeric color={valueColor} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <View>
          {typeof sub === 'string' ? (
            <Text variant="caption" tone="tertiary">
              {sub}
            </Text>
          ) : (
            sub
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.xxs,
    minHeight: 84,
  },
});
