import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSosStore } from '../../store/sosStore';
import { SOS_THEME } from '../../constants/sosTheme';
import { TranscriptMessage } from '../../types/sos.types';

export function SilentTranscript() {
  const status = useSosStore((state) => state.status);
  const messages = useSosStore((state) => state.transcriptMessages);
  const addMessage = useSosStore((state) => state.addTranscriptMessage);

  const [inputVal, setInputVal] = useState('');
  const [lsfModalVisible, setLsfModalVisible] = useState(false);
  const [activeLsfMessage, setActiveLsfMessage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<TranscriptMessage> | null>(null);

  const handleSendMessage = () => {
    if (!inputVal.trim()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const newMsg: TranscriptMessage = {
      id: `msg-${Date.now()}`,
      content: inputVal.trim(),
      sender: 'user',
      timestamp: new Date(),
      isSign: true, // indicates it was translated from sign language gloves
    };

    addMessage(newMsg);
    setInputVal('');

    // Simulate contact responding after 2 seconds
    setTimeout(() => {
      const responseMsg: TranscriptMessage = {
        id: `response-${Date.now()}`,
        content: "Bien reçu. Nous avons localisé votre signal et le véhicule d'assistance est en route.",
        sender: 'contact',
        timestamp: new Date(),
      };
      addMessage(responseMsg);
    }, 2000);
  };

  const handleOpenLsf = (content: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setActiveLsfMessage(content);
    setLsfModalVisible(true);
  };

  const formatTime = (dateObj: Date | string) => {
    try {
      const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: TranscriptMessage }) => {
    const isUser = item.sender === 'user';

    return (
      <View
        className="my-1.5 flex-row"
        style={{
          justifyContent: isUser ? 'flex-start' : 'flex-end',
        }}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isUser ? SOS_THEME.colors.safe : SOS_THEME.colors.surfaceAlt,
              borderColor: isUser ? 'rgba(29, 158, 117, 0.2)' : 'rgba(255,255,255,0.06)',
            },
          ]}
          className="rounded-2xl px-4 py-3 max-w-[80%] border"
        >
          <Text className="text-[14px] font-medium leading-relaxed" style={{ color: SOS_THEME.colors.textPrimary }}>
            {item.content}
          </Text>

          <View className="flex-row items-center justify-between mt-2 gap-3">
            <Text className="text-[10px]" style={{ color: isUser ? '#A7F3D0' : SOS_THEME.colors.textSecondary }}>
              {formatTime(item.timestamp)} {item.isSign && '• LSF'}
            </Text>

            {isUser && (
              <Pressable
                onPress={() => handleOpenLsf(item.content)}
                accessibilityLabel="Voir la traduction de ce message en langue des signes"
                accessibilityRole="button"
                className="bg-emerald-800/40 border border-emerald-600/30 px-2 py-0.5 rounded flex-row items-center gap-1 active:opacity-70"
              >
                <Feather name="video" size={10} color="#F1F5F9" />
                <Text className="text-[9px] font-bold text-slate-100">Voir en LSF</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (status !== 'active') {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: SOS_THEME.colors.surface }]} className="p-4 mx-4 my-2 select-none">
      <Text className="text-[14px] font-bold mb-3" style={{ color: SOS_THEME.colors.textPrimary }}>
        💬 Transcription Silencieuse LSF
      </Text>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View className="items-center justify-center py-6">
            <Feather name="message-square" size={24} color={SOS_THEME.colors.textMuted} className="mb-2" />
            <Text className="text-[12px] font-semibold text-center" style={{ color: SOS_THEME.colors.textSecondary }}>
              Aucun message pour le moment.
            </Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View className="flex-row items-center gap-2 mt-3 bg-slate-950/40 rounded-xl p-1.5 border border-white/5">
        <TextInput
          value={inputVal}
          onChangeText={setInputVal}
          placeholder="Traduire un signe ou écrire..."
          placeholderTextColor={SOS_THEME.colors.textMuted}
          className="flex-1 text-[14px] px-3 font-semibold"
          style={{ color: SOS_THEME.colors.textPrimary }}
        />
        <Pressable
          onPress={handleSendMessage}
          disabled={!inputVal.trim()}
          accessibilityLabel="Envoyer le message"
          accessibilityRole="button"
          style={[styles.sendBtn, { backgroundColor: inputVal.trim() ? SOS_THEME.colors.safe : 'rgba(255,255,255,0.02)' }]}
          className="w-10 h-10 rounded-xl items-center justify-center active:opacity-75"
        >
          <Feather name="send" size={14} color={inputVal.trim() ? '#FFF' : SOS_THEME.colors.textMuted} />
        </Pressable>
      </View>

      {/* LSF Visual Translation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={lsfModalVisible}
        onRequestClose={() => setLsfModalVisible(false)}
      >
        <View style={styles.modalOverlay} className="flex-1 justify-end bg-black/60">
          <View style={[styles.modalContent, { backgroundColor: SOS_THEME.colors.bg }]} className="rounded-t-3xl p-5 border-t border-white/10">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Feather name="video" size={18} color={SOS_THEME.colors.safe} />
                <Text className="text-[15px] font-bold" style={{ color: SOS_THEME.colors.textPrimary }}>
                  Traduction Visuelle LSF
                </Text>
              </View>
              <Pressable
                onPress={() => setLsfModalVisible(false)}
                className="w-8 h-8 rounded-full items-center justify-center bg-slate-800/40 border border-white/5 active:bg-slate-700/60"
              >
                <Feather name="x" size={16} color={SOS_THEME.colors.textPrimary} />
              </Pressable>
            </View>

            {/* Video Box Placeholder */}
            <View className="w-full h-[200px] rounded-2xl bg-slate-900 border border-white/5 items-center justify-center overflow-hidden mb-4 relative">
              {/* Simulated visual translation feed */}
              <ActivityIndicator color={SOS_THEME.colors.safe} size="small" className="absolute top-4 left-4" />
              <View className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 items-center justify-center mb-3">
                <Feather name="user" size={32} color={SOS_THEME.colors.safe} />
              </View>
              <Text className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                Flux LSF Simulateur Actif
              </Text>
              <Text className="text-[12px] text-center text-slate-400 max-w-[80%] font-medium">
                Avatar VoxManus traduisant en temps réel le message.
              </Text>
            </View>

            {/* Subtitles text */}
            <View className="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 mb-2">
              <Text className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: SOS_THEME.colors.textMuted }}>
                Texte traduit :
              </Text>
              <Text className="text-[14px] font-semibold text-slate-200 leading-relaxed">
                "{activeLsfMessage}"
              </Text>
            </View>

            <Pressable
              onPress={() => setLsfModalVisible(false)}
              style={[styles.closeBtn, { backgroundColor: SOS_THEME.colors.safe }]}
              className="w-full h-11 rounded-xl items-center justify-center active:opacity-75 mt-3"
            >
              <Text className="text-[14px] font-bold text-white">Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SOS_THEME.radius.lg,
    borderWidth: 1,
    borderColor: SOS_THEME.colors.border,
  },
  list: {
    height: 180,
    width: '100%',
  },
  listContent: {
    paddingVertical: 4,
  },
  bubble: {
    borderRadius: 16,
  },
  sendBtn: {
    minWidth: 40,
    minHeight: 40,
  },
  modalOverlay: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    minHeight: 380,
  },
  closeBtn: {
    minHeight: 44,
  },
});
