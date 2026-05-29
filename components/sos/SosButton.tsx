import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSosActivation } from '../../hooks/useSosActivation';
import { SOS_THEME } from '../../constants/sosTheme';
import { SosStatus } from '../../types/sos.types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface SosButtonComponentProps {
  status: SosStatus;
  progress: Animated.SharedValue<number>;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function SosButton() {
  const { progress, startPress, endPress, status } = useSosActivation();

  // Animation values
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  // Breathing animation (idle)
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion || !isMounted) return;

      if (status === 'idle') {
        scale.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1200 }),
            withTiming(1.0, { duration: 1200 })
          ),
          -1,
          false
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [status, scale]);

  // Pulse animation (active)
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion || !isMounted) return;

      if (status === 'active') {
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.3, { duration: 1800 }),
            withTiming(1.0, { duration: 0 })
          ),
          -1,
          false
        );
        pulseOpacity.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 1800 }),
            withTiming(1, { duration: 0 })
          ),
          -1,
          false
        );
      } else {
        pulseScale.value = 1;
        pulseOpacity.value = 0;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [status, pulseScale, pulseOpacity]);

  // Animated styles for the button
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Animated styles for the active pulse rings
  const pulseAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: pulseOpacity.value,
    };
  });

  // SVG Animated stroke calculations
  const radius = 64;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  const animatedCircleProps = useAnimatedProps(() => {
    'worklet';
    const strokeDashoffset = circumference * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  const getButtonText = () => {
    switch (status) {
      case 'activating':
        return 'Activation...';
      case 'active':
        return 'ACTIF';
      case 'cancelling':
        return 'Annulation...';
      case 'cancelled':
        return 'RESET';
      default:
        return 'SOS';
    }
  };

  const getButtonColor = () => {
    switch (status) {
      case 'active':
        return SOS_THEME.colors.danger;
      case 'activating':
        return SOS_THEME.colors.dangerDim;
      case 'cancelling':
      case 'cancelled':
        return SOS_THEME.colors.surfaceAlt;
      default:
        return SOS_THEME.colors.dangerDim;
    }
  };

  return (
    <View className="items-center justify-center py-6 select-none">
      {/* Active Glowing Pulse */}
      {status === 'active' && (
        <Animated.View
          style={[styles.pulseCircle, pulseAnimatedStyle]}
          className="absolute rounded-full border-4 border-rose-500/30"
        />
      )}

      {/* Button Wrapper */}
      <Animated.View style={[styles.container, buttonAnimatedStyle]}>
        <Pressable
          onPressIn={startPress}
          onPressOut={endPress}
          delayLongPress={3000}
          accessibilityLabel="Bouton SOS d'urgence. Maintenir 3 secondes pour activer."
          accessibilityRole="button"
          accessibilityState={{
            disabled: status === 'active' || status === 'activating' || status === 'cancelling',
            busy: status === 'activating' || status === 'cancelling',
          }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          className="items-center justify-center rounded-full"
          style={[
            styles.button,
            {
              backgroundColor: getButtonColor(),
              width: radius * 2,
              height: radius * 2,
            },
          ]}
        >
          {/* Progress Circle Layer */}
          {status === 'idle' && (
            <Svg className="absolute" style={styles.svgOverlay} width={radius * 2 + strokeWidth * 2} height={radius * 2 + strokeWidth * 2}>
              <Circle
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <AnimatedCircle
                cx={radius + strokeWidth}
                cy={radius + strokeWidth}
                r={radius}
                stroke={SOS_THEME.colors.danger}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                animatedProps={animatedCircleProps}
                strokeLinecap="round"
                transform={`rotate(-90 ${radius + strokeWidth} ${radius + strokeWidth})`}
              />
            </Svg>
          )}

          <Text
            className="font-bold text-center"
            style={[
              styles.buttonText,
              {
                color: status === 'active' ? '#000' : SOS_THEME.colors.textPrimary,
                fontSize: status === 'activating' ? 14 : 28,
              },
            ]}
          >
            {getButtonText()}
          </Text>
        </Pressable>
      </Animated.View>

      {status === 'idle' && (
        <Text className="text-[12px] font-semibold mt-3 text-center" style={{ color: SOS_THEME.colors.textSecondary }}>
          Maintenez appuyé pendant 3s pour lancer l'alerte
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 9999,
    shadowColor: SOS_THEME.colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttonText: {
    fontFamily: 'System',
    fontWeight: '700',
  },
  pulseCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  svgOverlay: {
    position: 'absolute',
  },
});
