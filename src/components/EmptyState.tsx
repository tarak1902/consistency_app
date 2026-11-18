import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

interface Props {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  tone?: 'card' | 'plain';
}

export function EmptyState({ title, body, actionLabel, onAction, icon, tone = 'card' }: Props) {
  const content = (
    <View style={styles.content}>
      {icon}
      <Text variant="title2">{title}</Text>
      {body ? (
        <Text variant="body" tone="secondary">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
  return tone === 'card' ? <Card size="lg">{content}</Card> : content;
}

/** Inline error with a retry: human copy, never a stack trace. */
export function ErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <Card>
      <View style={styles.content}>
        <Text variant="body">{message}</Text>
        <Button
          label={retryLabel}
          variant="secondary"
          size="md"
          onPress={onRetry}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.sm },
  action: { marginTop: space.xs },
});
