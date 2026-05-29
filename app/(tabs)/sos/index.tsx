import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, FlatList, Switch, Pressable, Modal, TextInput, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSosStore } from '../../../store/sosStore';
import { useLocationTracking } from '../../../hooks/useLocationTracking';
import { SOS_THEME } from '../../../constants/sosTheme';
import { SosButton } from '../../../components/sos/SosButton';
import { StatusBanner } from '../../../components/sos/StatusBanner';
import { GpsCard } from '../../../components/sos/GpsCard';
import { ContactCard } from '../../../components/sos/ContactCard';
import { QuickActions } from '../../../components/sos/QuickActions';
import { SilentTranscript } from '../../../components/sos/SilentTranscript';

const { width } = Dimensions.get('window');

export default function SosScreen() {
  // Trigger continuous location tracking hook
  useLocationTracking();

  const status = useSosStore((state) => state.status);
  const isOnline = useSosStore((state) => state.isOnline);
  const batteryLevel = useSosStore((state) => state.batteryLevel);
  const emergencyContacts = useSosStore((state) => state.emergencyContacts);
  const silentMode = useSosStore((state) => state.silentMode);
  const silentOptions = useSosStore((state) => state.silentOptions);
  const updateSilentOption = useSosStore((state) => state.updateSilentOption);
  const cancelSos = useSosStore((state) => state.cancelSos);

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cancellation PIN States
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleCancelClick = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setCancelModalVisible(true);
  };

  const handleVerifyPin = async () => {
    // Basic verification logic - accept '0000' or any 4 digit code for the prototype
    if (pinCode.length === 4) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setCancelModalVisible(false);
      setPinCode('');
      setPinError(false);
      await cancelSos(pinCode);
    } else {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      setPinError(true);
    }
  };

  return (
    <View style={[styles.viewport, { backgroundColor: SOS_THEME.colors.bg }]} className="flex-1 select-none">
      {/* 72px GLASS HEADER */}
      <BlurView intensity={80} tint="dark" style={styles.header} className="flex-row items-center justify-between px-4 border-b border-white/5 relative z-50">
        <View className="flex-row items-center gap-2">
          {/* SignBridge Inline Logo (SVG Concept as Shield Hand) */}
          <View className="w-8 h-8 rounded-lg bg-indigo-600 items-center justify-center border border-indigo-400/20">
            <Feather name="activity" size={16} color="#FFF" />
          </View>
          <View>
            <Text className="text-[14px] font-bold text-white tracking-wide">SignBridge</Text>
            <Text className="text-[10px] font-semibold text-indigo-400 mt-0.5">Mode Silencieux SOS</Text>
          </View>
        </View>

        {/* Real-time Clock */}
        <Text className="text-[13px] font-mono font-bold text-slate-300 ml-auto mr-4">
          {currentTime}
        </Text>

        {/* Battery & Shield Status Indicator */}
        <View className="flex-row items-center gap-2">
          {batteryLevel < 20 && (
            <View className="flex-row items-center gap-1 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded">
              <Feather name="battery" size={10} color="#EF4444" />
              <Text className="text-[9px] font-extrabold text-rose-400">{batteryLevel}%</Text>
            </View>
          )}
          <View className="w-8 h-8 rounded-full items-center justify-center bg-slate-900 border border-white/5">
            <Feather
              name="shield"
              size={14}
              color={status === 'active' ? SOS_THEME.colors.danger : SOS_THEME.colors.safe}
            />
          </View>
        </View>

        {/* Active Underline Effect */}
        {status === 'active' && (
          <View style={styles.headerActiveBar} className="absolute bottom-0 left-0 right-0 h-[2px] bg-rose-500" />
        )}
      </BlurView>

      {/* DASHBOARD SCROLLER */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} className="flex-grow">
        {/* Banner state */}
        <StatusBanner />

        {/* SOS button */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <SosButton />
        </Animated.View>

        {/* Silent LSF Translation transcription (only when active) */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <SilentTranscript />
        </Animated.View>

        {/* GPS location card */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)}>
          <GpsCard />
        </Animated.View>

        {/* Emergency contacts horizontal scroller */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} className="my-2 select-none">
          <Text className="text-[14px] font-bold mb-3 px-4" style={{ color: SOS_THEME.colors.textPrimary }}>
            👥 Contacts d'Urgence Notifiés
          </Text>
          <FlatList
            horizontal
            data={emergencyContacts}
            renderItem={({ item }) => <ContactCard contact={item} isSosActive={status === 'active'} />}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </Animated.View>

        {/* Quick action grid */}
        <Animated.View entering={FadeInDown.duration(400).delay(240)}>
          <QuickActions />
        </Animated.View>

        {/* Discrete Mode switches */}
        <Animated.View entering={FadeInDown.duration(400).delay(280)} className="mx-4 my-2 p-4 rounded-3xl border border-white/5 select-none" style={{ backgroundColor: SOS_THEME.colors.surface }}>
          <View className="flex-row items-center gap-2 mb-3">
            <Feather name="eye-off" size={16} color={SOS_THEME.colors.safe} />
            <Text className="text-[14px] font-bold" style={{ color: SOS_THEME.colors.textPrimary }}>
              Configuration Discrète SOS
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-2 border-b border-white/5">
            <View>
              <Text className="text-[13px] font-bold text-slate-200">Luminosité minimum</Text>
              <Text className="text-[11px] text-slate-400 mt-0.5">Assombrit automatiquement l'écran</Text>
            </View>
            <Switch
              value={silentOptions.reduceBrightness}
              onValueChange={(val) => updateSilentOption('reduceBrightness', val)}
              trackColor={{ false: '#1e293b', true: SOS_THEME.colors.safe }}
              thumbColor={silentOptions.reduceBrightness ? '#FFF' : '#94a3b8'}
            />
          </View>

          <View className="flex-row items-center justify-between py-2 border-b border-white/5">
            <View>
              <Text className="text-[13px] font-bold text-slate-200">Silence Absolu</Text>
              <Text className="text-[11px] text-slate-400 mt-0.5">Coupe l'intégralité des alertes vocales</Text>
            </View>
            <Switch
              value={silentOptions.disableSounds}
              onValueChange={(val) => updateSilentOption('disableSounds', val)}
              trackColor={{ false: '#1e293b', true: SOS_THEME.colors.safe }}
              thumbColor={silentOptions.disableSounds ? '#FFF' : '#94a3b8'}
            />
          </View>

          <View className="flex-row items-center justify-between py-2">
            <View>
              <Text className="text-[13px] font-bold text-slate-200">Vibrations Discrètes</Text>
              <Text className="text-[11px] text-slate-400 mt-0.5">Alertes uniquement via vibrations</Text>
            </View>
            <Switch
              value={silentOptions.silentVibrations}
              onValueChange={(val) => updateSilentOption('silentVibrations', val)}
              trackColor={{ false: '#1e293b', true: SOS_THEME.colors.safe }}
              thumbColor={silentOptions.silentVibrations ? '#FFF' : '#94a3b8'}
            />
          </View>
        </Animated.View>

        {/* ANNULATION SOS Sticky Button */}
        {status === 'active' && (
          <Animated.View entering={FadeInDown.duration(350)} exiting={FadeOut.duration(350)} className="mx-4 mt-4 mb-8">
            <Pressable
              onPress={handleCancelClick}
              accessibilityLabel="Annuler l'alerte SOS"
              accessibilityRole="button"
              style={[styles.cancelBtn, { backgroundColor: SOS_THEME.colors.dangerDim, borderColor: SOS_THEME.colors.danger }]}
              className="w-full rounded-2xl items-center justify-center border py-4 active:opacity-75"
            >
              <Text className="text-[15px] font-bold text-rose-100 uppercase tracking-wide">
                Annuler l'alerte
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Cancellation Verification Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={cancelModalVisible}
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay} className="flex-1 justify-center items-center bg-black/85 p-6">
          <View style={[styles.modalContent, { backgroundColor: SOS_THEME.colors.surface }]} className="w-full max-w-[320px] rounded-3xl p-5 border border-white/10 items-center">
            <View className="w-12 h-12 rounded-full bg-rose-500/10 items-center justify-center mb-3">
              <Feather name="lock" size={24} color={SOS_THEME.colors.danger} />
            </View>
            
            <Text className="text-[16px] font-bold text-center text-slate-100 mb-1">
              Code d'Annulation Requis
            </Text>
            <Text className="text-[12px] text-center text-slate-400 mb-4 px-2 leading-relaxed">
              Pour désactiver le signal SOS, veuillez saisir le code PIN de sécurité (par défaut : <Text className="font-bold text-white">0000</Text>).
            </Text>

            <TextInput
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={pinCode}
              onChangeText={(val) => {
                setPinCode(val);
                if (pinError) setPinError(false);
              }}
              placeholder="••••"
              placeholderTextColor={SOS_THEME.colors.textMuted}
              className="w-[120px] text-center text-[24px] font-mono py-2 rounded-xl bg-slate-950/60 border mb-4 font-bold text-white"
              style={{
                borderColor: pinError ? SOS_THEME.colors.danger : 'rgba(255,255,255,0.08)',
              }}
            />

            {pinError && (
              <Text className="text-[10px] font-bold text-rose-500 mb-3 text-center">
                Code PIN incorrect. Veuillez réessayer.
              </Text>
            )}

            <View className="flex-row items-center gap-3 w-full">
              <Pressable
                onPress={() => {
                  setCancelModalVisible(false);
                  setPinCode('');
                  setPinError(false);
                }}
                className="flex-1 py-3 rounded-xl border border-white/5 bg-slate-800/40 items-center justify-center active:opacity-75"
              >
                <Text className="text-[12px] font-bold text-slate-300">Retour</Text>
              </Pressable>
              
              <Pressable
                onPress={handleVerifyPin}
                disabled={pinCode.length !== 4}
                style={{ backgroundColor: pinCode.length === 4 ? SOS_THEME.colors.safe : 'rgba(255,255,255,0.02)' }}
                className="flex-1 py-3 rounded-xl items-center justify-center active:opacity-75"
              >
                <Text className="text-[12px] font-bold text-white">Désactiver</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    paddingTop: 12,
  },
  header: {
    height: 72,
    width: '100%',
  },
  headerActiveBar: {
    borderBottomWidth: 1,
  },
  scrollContainer: {
    paddingBottom: 24,
  },
  horizontalList: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  cancelBtn: {
    minHeight: 52,
  },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalContent: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
});
