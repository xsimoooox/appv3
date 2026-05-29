import React from 'react';
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSosStore } from '../../store/sosStore';
import { SOS_THEME } from '../../constants/sosTheme';

export function QuickActions() {
  const silentMode = useSosStore((state) => state.silentMode);
  const toggleSilentMode = useSosStore((state) => state.toggleSilentMode);
  const refreshLocation = useSosStore((state) => state.refreshLocation);

  const handleCallEmergency = async (number: string) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      console.log('[HAPTICS] Calling warning');
    }
    Linking.openURL(`tel:${number}`).catch(() => {
      console.warn(`Direct calling to ${number} not supported in this mock or device environment`);
    });
  };

  const handleSharePosition = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      console.log('[HAPTICS] Share trigger');
    }
    await refreshLocation();
    // Simulate share position message
    const store = useSosStore.getState();
    if (store.status === 'active' && store.location) {
      store.addTranscriptMessage({
        id: `share-${Date.now()}`,
        content: `📍 Position partagée: https://maps.google.com/?q=${store.location.lat},${store.location.lng}`,
        sender: 'user',
        timestamp: new Date(),
      });
    }
  };

  const handleToggleDiscrete = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      console.log('[HAPTICS] Discrete toggle');
    }
    toggleSilentMode();
  };

  return (
    <View className="px-4 py-2 select-none">
      <Text className="text-[14px] font-bold mb-3" style={{ color: SOS_THEME.colors.textPrimary }}>
        ⚡ Actions Rapides
      </Text>

      <View style={styles.grid} className="flex-row flex-wrap justify-between gap-[12px]">
        {/* Police */}
        <Pressable
          onPress={() => handleCallEmergency('19')}
          accessibilityLabel="Appeler la Police secours"
          accessibilityRole="button"
          style={[styles.gridBtn, { backgroundColor: 'rgba(226, 75, 74, 0.08)', borderColor: 'rgba(226, 75, 74, 0.2)' }]}
          className="rounded-2xl p-4 flex-row items-center border active:opacity-75"
        >
          <View style={styles.iconContainer} className="bg-rose-500/10 w-11 h-11 rounded-xl items-center justify-center mr-3">
            <Feather name="shield" size={20} color={SOS_THEME.colors.danger} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13px] font-bold text-slate-100">Police</Text>
            <Text className="text-[10px] font-semibold text-rose-400 mt-0.5">Appeler le 19</Text>
          </View>
        </Pressable>

        {/* Ambulance */}
        <Pressable
          onPress={() => handleCallEmergency('15')}
          accessibilityLabel="Appeler les Ambulances et Pompiers"
          accessibilityRole="button"
          style={[styles.gridBtn, { backgroundColor: 'rgba(55, 138, 221, 0.08)', borderColor: 'rgba(55, 138, 221, 0.2)' }]}
          className="rounded-2xl p-4 flex-row items-center border active:opacity-75"
        >
          <View style={styles.iconContainer} className="bg-blue-500/10 w-11 h-11 rounded-xl items-center justify-center mr-3">
            <Feather name="activity" size={20} color={SOS_THEME.colors.info} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13px] font-bold text-slate-100">Ambulance</Text>
            <Text className="text-[10px] font-semibold text-blue-400 mt-0.5">Appeler le 15</Text>
          </View>
        </Pressable>

        {/* Partager Position */}
        <Pressable
          onPress={handleSharePosition}
          accessibilityLabel="Actualiser et partager ma position GPS"
          accessibilityRole="button"
          style={[styles.gridBtn, { backgroundColor: 'rgba(29, 158, 117, 0.08)', borderColor: 'rgba(29, 158, 117, 0.2)' }]}
          className="rounded-2xl p-4 flex-row items-center border active:opacity-75"
        >
          <View style={styles.iconContainer} className="bg-emerald-500/10 w-11 h-11 rounded-xl items-center justify-center mr-3">
            <Feather name="share-2" size={20} color={SOS_THEME.colors.safe} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13px] font-bold text-slate-100">Partager GPS</Text>
            <Text className="text-[10px] font-semibold text-emerald-400 mt-0.5">Actualiser & Envoi</Text>
          </View>
        </Pressable>

        {/* Mode discret */}
        <Pressable
          onPress={handleToggleDiscrete}
          accessibilityLabel={silentMode ? "Désactiver le mode discret" : "Activer le mode discret"}
          accessibilityRole="button"
          style={[
            styles.gridBtn,
            {
              backgroundColor: silentMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(26, 26, 46, 0.6)',
              borderColor: silentMode ? 'rgba(255, 255, 255, 0.15)' : SOS_THEME.colors.border,
            },
          ]}
          className="rounded-2xl p-4 flex-row items-center border active:opacity-75"
        >
          <View style={styles.iconContainer} className="bg-slate-800/40 w-11 h-11 rounded-xl items-center justify-center mr-3">
            <Feather name={silentMode ? "eye" : "eye-off"} size={20} color={silentMode ? '#FFF' : SOS_THEME.colors.textSecondary} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13px] font-bold text-slate-100">Mode Discret</Text>
            <Text className="text-[10px] font-semibold text-slate-400 mt-0.5">{silentMode ? "Activé (Écran Sombre)" : "Inactif"}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  gridBtn: {
    width: '48%',
    minHeight: 64,
  },
  iconContainer: {
    minWidth: 44,
    minHeight: 44,
  },
});
