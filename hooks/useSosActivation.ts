import { useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useSharedValue, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { useSosStore } from '../store/sosStore';

export function useSosActivation() {
  const activateSos = useSosStore((state) => state.activateSos);
  const status = useSosStore((state) => state.status);

  // Reanimated shared values to animate circular loading ring
  const progress = useSharedValue(0);

  // Keep track of timeout handlers for progressive haptics
  const hapticTimer1 = useRef<NodeJS.Timeout | null>(null);
  const hapticTimer2 = useRef<NodeJS.Timeout | null>(null);
  const triggerTimer = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (hapticTimer1.current) clearTimeout(hapticTimer1.current);
    if (hapticTimer2.current) clearTimeout(hapticTimer2.current);
    if (triggerTimer.current) clearTimeout(triggerTimer.current);
    hapticTimer1.current = null;
    hapticTimer2.current = null;
    triggerTimer.current = null;
  }, []);

  const startPress = useCallback(() => {
    if (status !== 'idle') return;

    clearTimers();

    // Reset progress to 0 and animate to 1 linearly over 3000ms
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 3000,
      easing: Easing.linear,
    });

    // Schedule Haptic feedbacks
    // 0.5s -> Impact Light
    hapticTimer1.current = setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        // Fallback for mock environments
        console.log('[HAPTICS] Light Impact');
      }
    }, 500);

    // 1.5s -> Impact Medium
    hapticTimer2.current = setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        console.log('[HAPTICS] Medium Impact');
      }
    }, 1500);

    // 3.0s -> Impact Heavy + Notification Success + Activate
    triggerTimer.current = setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        console.log('[HAPTICS] Heavy Success Notification');
      }
      // Invoke store activation on JS thread
      activateSos();
    }, 3000);
  }, [status, activateSos, progress, clearTimers]);

  const endPress = useCallback(() => {
    if (status !== 'idle') return;

    clearTimers();

    // spring-like quick reset if released early
    progress.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
  }, [status, progress, clearTimers]);

  return {
    progress,
    startPress,
    endPress,
    status,
  };
}
