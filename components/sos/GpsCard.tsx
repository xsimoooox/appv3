import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Linking, Platform, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSosStore } from '../../store/sosStore';
import { SOS_THEME } from '../../constants/sosTheme';

let MapView: any = null;
let Marker: any = null;

try {
  // Graceful try-catch import to prevent compile issues on web or environment variances
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch {
  MapView = null;
  Marker = null;
}

export function GpsCard() {
  const location = useSosStore((state) => state.location);
  const locationStatus = useSosStore((state) => state.locationStatus);
  const refreshLocation = useSosStore((state) => state.refreshLocation);

  // Reanimated radar pulse values
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  // Shimmer opacity values for skeletons
  const shimmerOpacity = useSharedValue(0.3);

  // Shimmer loading loop
  useEffect(() => {
    let isMounted = true;
    if (locationStatus === 'loading') {
      shimmerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 600 }),
          withTiming(0.3, { duration: 600 })
        ),
        -1,
        true
      );
    }
    return () => {
      isMounted = false;
    };
  }, [locationStatus, shimmerOpacity]);

  // GPS scanning radar pulse loop (idle/active map)
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion || !isMounted) return;

      pulseScale.value = withRepeat(
        withTiming(1.8, { duration: 3000 }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 0 }),
          withTiming(0, { duration: 3000 })
        ),
        -1,
        false
      );
    });

    return () => {
      isMounted = false;
    };
  }, [pulseScale, pulseOpacity]);

  const shimmerStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: shimmerOpacity.value,
    };
  });

  const radarStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: pulseOpacity.value,
    };
  });

  const handleRefresh = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      console.log('[HAPTICS] Refresh Trigger');
    }
    await refreshLocation();
  };

  const handleOpenSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  // Skeleton shimmer layout
  if (locationStatus === 'loading' || locationStatus === 'idle') {
    return (
      <View style={[styles.card, { backgroundColor: SOS_THEME.colors.surface }]} className="p-4 mx-4 my-2">
        <Text className="text-[14px] font-bold mb-3" style={{ color: SOS_THEME.colors.textPrimary }}>
          📍 Géolocalisation
        </Text>
        <Animated.View style={[styles.shimmerBox, shimmerStyle]} className="rounded-xl w-full h-[120px] bg-slate-800/40 items-center justify-center">
          <ActivityIndicator color={SOS_THEME.colors.info} size="small" />
          <Text className="text-[12px] font-semibold mt-2 text-slate-500">Localisation en cours...</Text>
        </Animated.View>
      </View>
    );
  }

  // Permissions or location unavailable
  if (locationStatus === 'unavailable' || locationStatus === 'error' || !location) {
    return (
      <View style={[styles.card, { backgroundColor: SOS_THEME.colors.surface }]} className="p-4 mx-4 my-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[14px] font-bold" style={{ color: SOS_THEME.colors.textPrimary }}>
            📍 Localisation GPS
          </Text>
          <View className="bg-rose-500/10 px-2.5 py-0.5 rounded border border-rose-500/25">
            <Text className="text-[10px] font-bold text-rose-500">INDISPONIBLE</Text>
          </View>
        </View>

        <View className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-4 items-center">
          <Feather name="alert-triangle" size={24} color={SOS_THEME.colors.danger} className="mb-2" />
          <Text className="text-[13px] font-bold text-center text-slate-200 mb-1">
            Service GPS Indisponible
          </Text>
          <Text className="text-[11px] text-center text-slate-500 leading-relaxed mb-4">
            Veuillez autoriser l'accès à la position dans vos paramètres pour assurer la transmission de vos coordonnées SOS.
          </Text>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleOpenSettings}
              accessibilityLabel="Ouvrir les réglages pour autoriser la localisation"
              accessibilityRole="button"
              style={styles.actionBtn}
              className="bg-rose-500/10 border border-rose-500/30 px-3.5 py-2 rounded-xl active:opacity-70"
            >
              <Text className="text-[12px] font-bold text-rose-400">Autoriser la localisation</Text>
            </Pressable>
            <Pressable
              onPress={handleRefresh}
              accessibilityLabel="Réessayer de récupérer la position GPS"
              accessibilityRole="button"
              style={styles.actionBtn}
              className="bg-slate-800/40 border border-slate-700/30 px-3.5 py-2 rounded-xl active:opacity-70 flex-row items-center gap-1.5"
            >
              <Feather name="refresh-cw" size={12} color="#F1F5F9" />
              <Text className="text-[12px] font-bold text-white">Réessayer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: SOS_THEME.colors.surface }]} className="p-4 mx-4 my-2">
      {/* Card Header */}
      <View className="flex-row items-center justify-between mb-3 select-none">
        <View className="flex-row items-center gap-2">
          <Text className="text-[14px] font-bold" style={{ color: SOS_THEME.colors.textPrimary }}>
            📍 Localisation GPS
          </Text>
          <View className="bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
            <Text className="text-[10px] font-bold text-emerald-500">ACTIF</Text>
          </View>
        </View>
        <Pressable
          onPress={handleRefresh}
          accessibilityLabel="Actualiser la position GPS"
          accessibilityRole="button"
          className="w-10 h-10 items-center justify-center bg-slate-800/30 border border-white/5 rounded-full active:bg-slate-700/50"
        >
          <Feather name="refresh-cw" size={14} color={SOS_THEME.colors.textPrimary} />
        </Pressable>
      </View>

      {/* Map View Container */}
      <View style={styles.mapContainer} className="overflow-hidden rounded-2xl mb-3 border border-white/5 bg-slate-900/60">
        {MapView ? (
          <MapView
            style={styles.map}
            scrollEnabled={false}
            zoomEnabled={false}
            initialRegion={{
              latitude: location.lat,
              longitude: location.lng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
          >
            <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}>
              <View className="items-center justify-center w-10 h-10">
                <Animated.View
                  style={[styles.radarRing, radarStyle]}
                  className="absolute w-8 h-8 rounded-full bg-blue-500/30 border border-blue-500"
                />
                <View className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white items-center justify-center shadow-md">
                  <View className="w-1.5 h-1.5 rounded-full bg-white" />
                </View>
              </View>
            </Marker>
          </MapView>
        ) : (
          /* Simulated Grid / Fallback Web Mock Map */
          <View className="w-full h-full justify-center items-center relative" style={{ backgroundColor: '#0f172a' }}>
            <View className="absolute inset-0 opacity-20 flex-row flex-wrap gap-2 p-2">
              {Array.from({ length: 60 }).map((_, i) => (
                <View key={i} className="w-4 h-4 rounded bg-slate-500" />
              ))}
            </View>
            <View className="items-center justify-center">
              <Animated.View
                style={[styles.radarRing, radarStyle]}
                className="absolute w-14 h-14 rounded-full bg-blue-500/35 border border-blue-500/50"
              />
              <View className="w-4 h-4 rounded-full bg-blue-500 border border-white items-center justify-center shadow-lg">
                <View className="w-1.5 h-1.5 rounded-full bg-white" />
              </View>
            </View>
            <Text className="text-[10px] font-bold text-slate-500 mt-2 absolute bottom-2 select-none">
              Aperçu Static (Coordonnées Réelles)
            </Text>
          </View>
        )}
      </View>

      {/* Details Box */}
      <View className="bg-slate-950/40 rounded-xl p-3 border border-white/5">
        <Text className="text-[13px] font-bold text-slate-200" numberOfLines={1}>
          {location.address}
        </Text>
        <View className="flex-row items-center gap-4 mt-2">
          <Text className="text-[11px] font-semibold" style={{ color: SOS_THEME.colors.textMuted }}>
            Lat: <Text className="text-slate-400 font-mono">{location.lat.toFixed(6)}</Text>
          </Text>
          <Text className="text-[11px] font-semibold" style={{ color: SOS_THEME.colors.textMuted }}>
            Lng: <Text className="text-slate-400 font-mono">{location.lng.toFixed(6)}</Text>
          </Text>
          <Text className="text-[11px] font-semibold ml-auto" style={{ color: SOS_THEME.colors.textMuted }}>
            Précision: <Text className="text-blue-400 font-bold">±{location.accuracy}m</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SOS_THEME.radius.lg,
    borderWidth: 1,
    borderColor: SOS_THEME.colors.border,
  },
  shimmerBox: {
    height: 120,
    width: '100%',
  },
  mapContainer: {
    height: 128,
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  radarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  actionBtn: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
