import * as Haptics from 'expo-haptics';

const swallow = () => undefined;

/** selection on tick, success when the day completes, warning on a rejected
 *  action, rigid ticks during hold-to-lock. */
export const haptics = {
  selection: () => Haptics.selectionAsync().catch(swallow),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(swallow),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(swallow),
  rigid: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(swallow),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow),
};
