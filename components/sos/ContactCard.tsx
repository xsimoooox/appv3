import React from 'react';
import { StyleSheet, View, Text, Pressable, Image, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EmergencyContact } from '../../types/sos.types';
import { SOS_THEME } from '../../constants/sosTheme';

interface ContactCardProps {
  contact: EmergencyContact;
  isSosActive: boolean;
}

export function ContactCard({ contact, isSosActive }: ContactCardProps) {
  const isNotified = contact.status === 'notified' || contact.status === 'connected';

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getStatusText = () => {
    switch (contact.status) {
      case 'notified':
        return 'Notifié';
      case 'connected':
        return 'Connecté';
      case 'unreachable':
        return 'Injoignable';
      default:
        return 'En attente';
    }
  };

  const getStatusColor = () => {
    switch (contact.status) {
      case 'connected':
      case 'notified':
        return SOS_THEME.colors.safe;
      case 'unreachable':
        return SOS_THEME.colors.danger;
      default:
        return SOS_THEME.colors.textMuted;
    }
  };

  const handleCall = () => {
    const cleanPhone = contact.phone.replace(/\s/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      console.warn('Direct calling not supported in this mock or device environment');
    });
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: SOS_THEME.colors.surface,
          borderColor: isSosActive && isNotified ? SOS_THEME.colors.safe : SOS_THEME.colors.border,
          borderWidth: isSosActive && isNotified ? 1.5 : 1,
        },
      ]}
      className="p-3 mr-3 rounded-2xl flex-row items-center w-[220px] select-none"
    >
      {/* Avatar Circle */}
      <View
        style={[
          styles.avatarContainer,
          {
            backgroundColor: isSosActive && isNotified ? 'rgba(29, 158, 117, 0.1)' : '#1e293b',
            borderColor: isSosActive && isNotified ? SOS_THEME.colors.safe : 'rgba(255,255,255,0.05)',
          },
        ]}
        className="w-12 h-12 rounded-full items-center justify-center border"
      >
        {contact.avatarUrl ? (
          <Image source={{ uri: contact.avatarUrl }} className="w-full h-full rounded-full" />
        ) : (
          <Text
            className="text-[14px] font-bold"
            style={{ color: isSosActive && isNotified ? SOS_THEME.colors.safe : SOS_THEME.colors.textPrimary }}
          >
            {getInitials(contact.name)}
          </Text>
        )}
      </View>

      {/* Info Column */}
      <View className="ml-3 flex-1 min-w-0">
        <Text className="text-[13px] font-bold text-slate-100" numberOfLines={1}>
          {contact.name}
        </Text>
        <Text className="text-[11px] font-medium text-slate-400 mt-0.5">
          {contact.relation}
        </Text>

        {/* Status Badge */}
        <View className="flex-row items-center gap-1 mt-1.5">
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor() }} />
          <Text className="text-[10px] font-bold" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      {/* Direct Quick Action Button */}
      <Pressable
        onPress={handleCall}
        accessibilityLabel={`Appeler ${contact.name}`}
        accessibilityRole="button"
        style={[styles.callButton, { backgroundColor: isSosActive && isNotified ? 'rgba(29, 158, 117, 0.12)' : 'rgba(255,255,255,0.04)' }]}
        className="w-9 h-9 rounded-full items-center justify-center ml-2 border border-white/5 active:opacity-75"
      >
        <Feather
          name="phone"
          size={12}
          color={isSosActive && isNotified ? SOS_THEME.colors.safe : SOS_THEME.colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SOS_THEME.radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarContainer: {
    borderWidth: 1,
  },
  callButton: {
    minWidth: 36,
    minHeight: 36,
  },
});
