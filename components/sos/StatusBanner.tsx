import React, { useEffect } from 'react';
import { StyleSheet, View, Text, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  LinearTransition,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSosStore } from '../../store/sosStore';
import { SOS_THEME } from '../../constants/sosTheme';

export function StatusBanner() {
  const status = useSosStore((state) => state.status);
  const activatedAt = useSosStore((state) => state.activatedAt);
  const isOnline = useSosStore((state) => state.isOnline);
  const batteryLevel = useSosStore((state) => state.batteryLevel);
  const isLowBattery = useSosStore((state) => state.isLowBattery);

  // Blink indicator animation (active)
  const blinkOpacity = useSharedValue(1);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion || !isMounted) return;

      if (status === 'active') {
        blinkOpacity.value = withRepeat(
          withSequence(
            withTiming(0.2, { duration: 600 }),
            withTiming(1, { duration: 600 })
          ),
          -1,
          true
        );
      } else {
        blinkOpacity.value = 1;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [status, blinkOpacity]);

  const blinkStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: blinkOpacity.value,
    };
  });

  const formatActivationTime = () => {
    if (!activatedAt) return '';
    try {
      const date = new Date(activatedAt);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderContent = () => {
    // Offline Warning
    if (!isOnline) {
      return (
        <View style={[styles.banner, { backgroundColor: SOS_THEME.colors.dangerDim }]} className="flex-row items-center gap-3">
          <Feather name="wifi-off" size={18} color="#F1F5F9" />
          <View className="flex-1">
            <Text className="text-[14px] font-bold" style={{ color: '#F1F5F9' }}>
              Connexion perdue — Mode hors-ligne actif
            </Text>
            <Text className="text-[12px] font-medium" style={{ color: '#94A3B8' }}>
              Les alertes seront envoyées dès le retour réseau.
            </Text>
          </View>
        </View>
      );
    }

    if (status === 'active') {
      return (
        <View style={[styles.banner, { backgroundColor: SOS_THEME.colors.dangerDim }]} className="flex-row items-start gap-3">
          <Animated.View style={blinkStyle} className="mt-1">
            <View className="w-3.5 h-3.5 rounded-full bg-rose-500 items-center justify-center">
              <View className="w-2 h-2 rounded-full bg-white" />
            </View>
          </Animated.View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold tracking-wide" style={{ color: SOS_THEME.colors.textPrimary }}>
              ALERTE SOS ACTIVE
            </Text>
            <Text className="text-[13px] font-medium mt-0.5" style={{ color: '#94A3B8' }}>
              Activée à: <Text className="font-bold text-white">{formatActivationTime()}</Text>
            </Text>
            <View className="flex-row items-center gap-3 mt-1.5 pt-1.5 border-t border-white/5">
              <Text className="text-[12px] font-semibold flex-row items-center" style={{ color: '#94A3B8' }}>
                🔋 Batterie: <Text className={isLowBattery ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{batteryLevel}%</Text>
              </Text>
              <Text className="text-[12px] font-semibold" style={{ color: '#94A3B8' }}>
                📡 Signal: <Text className="text-emerald-400 font-bold">100% (Sécurisé)</Text>
              </Text>
            </View>
          </View>
        </View>
      );
    }

    if (status === 'activating') {
      return (
        <View style={[styles.banner, { backgroundColor: '#1A1A2E' }]} className="flex-row items-center gap-3">
          <Feather name="loader" size={18} color={SOS_THEME.colors.danger} className="animate-spin" />
          <Text className="text-[14px] font-bold flex-1" style={{ color: SOS_THEME.colors.textPrimary }}>
            Déclenchement du signal SOS d'urgence...
          </Text>
        </View>
      );
    }

    // Default Idle State
    return (
      <View style={[styles.banner, { backgroundColor: SOS_THEME.colors.surface }]} className="flex-row items-center gap-3">
        <Feather name="shield" size={20} color={SOS_THEME.colors.safe} />
        <View className="flex-1">
          <Text className="text-[14px] font-bold" style={{ color: SOS_THEME.colors.textPrimary }}>
            Vous êtes en sécurité
          </Text>
          <Text className="text-[12px] font-semibold" style={{ color: SOS_THEME.colors.textSecondary }}>
            Dispositif de veille SOS actif et opérationnel.
          </Text>
        </View>
        {isLowBattery && (
          <View className="bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex-row items-center gap-1">
            <Feather name="battery-charging" size={12} color="#EF4444" />
            <Text className="text-[10px] font-bold text-rose-500">Faible</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(350)}
      style={styles.container}
    >
      {renderContent()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: SOS_THEME.radius.md,
    overflow: 'hidden',
  },
  banner: {
    padding: SOS_THEME.spacing.md,
    borderRadius: SOS_THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
});
