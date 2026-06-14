import { Easing } from 'react-native-reanimated';

export const SOS_THEME = {
  colors: {
    bg: '#F0F0F0',            // fond principal
    surface: '#111827',       // cards
    surfaceAlt: '#1A1A2E',    // cards secondaires
    border: 'rgba(255,255,255,0.08)',
    danger: '#E24B4A',        // rouge urgence
    dangerDim: '#7B1F1E',     // rouge sombre
    safe: '#2E7D32',          // vert sécurité
    info: '#378ADD',          // bleu info
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 20,
    xl: 28,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  animation: {
    durationFast: 200,
    durationMed: 350,
    durationSlow: 600,
    easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
  },
};
