import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Globe,
  HelpCircle,
  Key,
  LogOut,
  Mail,
  Moon,
  Phone,
  Settings,
  Shield,
  Sun,
  Trash2,
  User,
  Volume2,
  ChevronDown,
  Heart,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { getVoxManusUser, saveVoxManusUser, clearVoxManusUser } from '../lib/voxmanusUser';
import { performLogout } from '../lib/logoutSession';

const PROFILE_STORAGE_KEY = 'voxmanus_profile_settings';

function SettingsInput({ label, value, onChange, type = 'text', placeholder = '', icon: Icon }) {
  return (
    <div className="mb-4">
      {label && <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>{label}</label>}
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
        {Icon && <Icon size={16} style={{ color: '#999' }} />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
          style={{ color: '#16163A' }}
        />
      </div>
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange, description = '' }) {
  return (
    <div className="flex items-start justify-between p-3.5 rounded-2xl border mb-3" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
      <div className="flex-1">
        <p className="text-sm font-bold m-0" style={{ color: '#16163A' }}>{label}</p>
        {description && <p className="text-xs m-0 mt-1" style={{ color: '#666680' }}>{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="w-12 h-6 rounded-full border-2 transition-all shrink-0 ml-3"
        style={{
          background: checked ? '#0000B4' : '#D9D9E8',
          borderColor: checked ? '#0000B4' : '#D9D9E8',
        }}
        aria-label={`${label}: ${checked ? 'ON' : 'OFF'}`}
      >
        <div
          className="w-4 h-4 rounded-full bg-white transition-transform"
          style={{
            transform: checked ? 'translateX(24px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}

function SectionTitle({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-6 pt-6 border-t" style={{ borderColor: '#E0E0E8' }}>
      {Icon && <Icon size={18} style={{ color: '#0000B4' }} />}
      <h2 className="text-lg font-extrabold m-0" style={{ color: '#16163A' }}>{title}</h2>
    </div>
  );
}

export default function Parametres({ variant = 'deaf' }) {
  const navigate = useNavigate();
  const user = getVoxManusUser();
  const isDark = variant === 'deaf';
  const accentColor = isDark ? '#0000B4' : '#2E7D32';
  const accentBg = isDark ? '#EEF2FF' : '#EAF5EB';
  const homePath = isDark ? '/accueil' : '/entendant/accueil';

  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  });

  const [settings, setSettings] = useState({
    language: 'Français',
    theme: 'system',
    timezone: 'Africa/Casablanca',
    timeFormat: '24h',
    voiceSpeed: 1,
    voicePitch: 'normal',
    notifications: true,
    emailNotifications: true,
    soundNotifications: true,
    vibration: true,
    twoFactorEnabled: false,
    biometricEnabled: false,
    keepAudioRecordings: true,
    autoLanguageDetection: true,
    alwaysListening: false,
    textSize: 100,
    highContrast: false,
    reduceAnimations: false,
    enableSubtitles: false,
  });

  const [activeSection, setActiveSection] = useState('profile');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const handleLogout = () => {
    clearVoxManusUser();
    navigate('/auth', { replace: true });
  };

  const handleBack = () => navigate(homePath);

  const renderProfileSection = () => (
    <div>
      <div className="rounded-3xl p-6 mb-6" style={{ background: accentBg, border: `2px solid ${accentColor}` }}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: accentColor, color: '#fff' }}>
            {(user?.name || 'U').split(' ').map((n) => n[0]).join('').toUpperCase()}
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#FFFFFF', border: `2px solid ${accentColor}` }}
          >
            <Camera size={18} style={{ color: accentColor }} />
          </button>
        </div>
        <h3 className="text-xl font-bold m-0 mb-2" style={{ color: accentColor }}>
          {profile.fullName || user?.name || 'Utilisateur'}
        </h3>
        <p className="text-sm m-0 mb-3" style={{ color: '#666680' }}>
          {profile.email || 'Email non configuré'}
        </p>
        <div className="flex items-center gap-2 inline-flex px-3.5 py-1.5 rounded-full" style={{ background: '#FFFFFF' }}>
          <Heart size={14} style={{ color: '#FF6B6B' }} />
          <span className="text-xs font-bold" style={{ color: '#333' }}>Premium</span>
        </div>
      </div>

      <SettingsInput
        label="Nom complet"
        value={profile.fullName || user?.name || ''}
        onChange={(value) => setProfile({ ...profile, fullName: value })}
        icon={User}
      />

      <SettingsInput
        label="Adresse email"
        value={profile.email || ''}
        onChange={(value) => setProfile({ ...profile, email: value })}
        type="email"
        icon={Mail}
      />

      <SettingsInput
        label="Numéro de téléphone"
        value={profile.phone || user?.phoneNumber || ''}
        onChange={(value) => setProfile({ ...profile, phone: value })}
        icon={Phone}
      />

      <button
        type="button"
        className="w-full py-3 rounded-2xl font-bold border-0 mb-3 transition-all"
        style={{ background: accentColor, color: '#fff' }}
      >
        Mettre à jour le profil
      </button>

      <button
        type="button"
        className="w-full py-3 rounded-2xl font-bold border-0 transition-all"
        style={{ background: '#F0F0F0', color: '#666' }}
      >
        Voir mon profil public
      </button>
    </div>
  );

  const renderAccountSection = () => (
    <div>
      <SectionTitle title="Sécurité du compte" icon={Key} />
      
      <SettingsInput
        label="Ancien mot de passe"
        value=""
        onChange={() => {}}
        type="password"
        icon={Lock}
      />

      <SettingsInput
        label="Nouveau mot de passe"
        value=""
        onChange={() => {}}
        type="password"
        icon={Lock}
      />

      <SettingsInput
        label="Confirmer le mot de passe"
        value=""
        onChange={() => {}}
        type="password"
        icon={Lock}
      />

      <button
        type="button"
        className="w-full py-3 rounded-2xl font-bold border-0 mb-6 transition-all"
        style={{ background: accentColor, color: '#fff' }}
      >
        Changer le mot de passe
      </button>

      <SectionTitle title="Comptes externes" icon={Globe} />
      
      {[
        { name: 'Google', icon: '🔵' },
        { name: 'Apple', icon: '⚫' },
        { name: 'Microsoft', icon: '🔷' },
      ].map((service) => (
        <div key={service.name} className="p-3.5 rounded-2xl border mb-3 flex items-center justify-between" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">{service.icon}</span>
            <span className="font-bold" style={{ color: '#16163A' }}>{service.name}</span>
          </div>
          <button className="px-4 py-1.5 rounded-full text-xs font-bold" style={{ background: accentColor, color: '#fff' }}>
            Connecter
          </button>
        </div>
      ))}

      <SectionTitle title="Suppression du compte" icon={Trash2} />
      
      <button
        type="button"
        onClick={() => setShowDeleteModal(true)}
        className="w-full py-3 rounded-2xl font-bold border-0 transition-all"
        style={{ background: '#FFE0E0', color: '#E53935' }}
      >
        Supprimer mon compte
      </button>
    </div>
  );

  const renderPreferencesSection = () => (
    <div>
      <SectionTitle title="Langue & Localisation" icon={Globe} />
      
      <div className="mb-4">
        <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>Langue de l'interface</label>
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border cursor-pointer" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
          <Globe size={16} style={{ color: '#999' }} />
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
            style={{ color: '#16163A' }}
          >
            <option value="Français">Français</option>
            <option value="العربية">العربية</option>
            <option value="English">English</option>
            <option value="Español">Español</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>Thème</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ id: 'light', icon: Sun, label: 'Clair' }, { id: 'dark', icon: Moon, label: 'Sombre' }, { id: 'system', label: 'Système' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setSettings({ ...settings, theme: t.id })}
              className="py-3 rounded-2xl border-2 font-bold transition-all"
              style={{
                background: settings.theme === t.id ? accentColor : '#FFFFFF',
                borderColor: settings.theme === t.id ? accentColor : '#D9D9E8',
                color: settings.theme === t.id ? '#fff' : '#16163A',
              }}
            >
              {t.icon && <t.icon size={16} className="inline mr-1" />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <SettingsInput
        label="Fuseau horaire"
        value={settings.timezone}
        onChange={(value) => setSettings({ ...settings, timezone: value })}
        icon={Globe}
      />

      <SectionTitle title="Format de date & heure" icon={Settings} />
      
      <div className="mb-4">
        <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>Format</label>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: '24h', label: 'Format 24h' }, { id: '12h', label: 'Format 12h' }].map((f) => (
            <button
              key={f.id}
              onClick={() => setSettings({ ...settings, timeFormat: f.id })}
              className="py-3 rounded-2xl border-2 font-bold transition-all"
              style={{
                background: settings.timeFormat === f.id ? accentColor : '#FFFFFF',
                borderColor: settings.timeFormat === f.id ? accentColor : '#D9D9E8',
                color: settings.timeFormat === f.id ? '#fff' : '#16163A',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderVoiceSection = () => (
    <div>
      <SectionTitle title="Voix de l'assistant" icon={Volume2} />
      
      {[1, 2, 3].map((v) => (
        <div key={v} className="p-4 rounded-2xl border mb-3 flex items-center justify-between" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
          <div>
            <p className="font-bold m-0" style={{ color: '#16163A' }}>Voix {v}</p>
            <p className="text-xs m-0 mt-1" style={{ color: '#666680' }}>{v === 1 ? 'Féminine' : v === 2 ? 'Masculine' : 'Neutre'}</p>
          </div>
          <button className="px-3 py-2 rounded-full" style={{ background: accentBg, border: `1px solid ${accentColor}` }}>
            ▶ Écouter
          </button>
        </div>
      ))}

      <SectionTitle title="Paramètres vocaux" icon={Volume2} />
      
      <div className="mb-4">
        <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>Vitesse de parole: {settings.voiceSpeed.toFixed(1)}x</label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={settings.voiceSpeed}
          onChange={(e) => setSettings({ ...settings, voiceSpeed: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>Tonalité vocale</label>
        <select
          value={settings.voicePitch}
          onChange={(e) => setSettings({ ...settings, voicePitch: e.target.value })}
          className="w-full px-3.5 py-2.5 rounded-2xl border"
          style={{ borderColor: '#D9D9E8', background: '#FFFFFF', color: '#16163A' }}
        >
          <option value="grave">Grave</option>
          <option value="normal">Normal</option>
          <option value="aigu">Aigu</option>
        </select>
      </div>

      <ToggleSwitch
        label="Détection automatique de la langue"
        checked={settings.autoLanguageDetection}
        onChange={(value) => setSettings({ ...settings, autoLanguageDetection: value })}
      />

      <ToggleSwitch
        label="Mode écoute continue"
        checked={settings.alwaysListening}
        onChange={(value) => setSettings({ ...settings, alwaysListening: value })}
        description="Attention: Peut affecter la batterie et la confidentialité"
      />
    </div>
  );

  const renderNotificationsSection = () => (
    <div>
      <SectionTitle title="Notifications" icon={Bell} />
      
      <ToggleSwitch
        label="Notifications push"
        checked={settings.notifications}
        onChange={(value) => setSettings({ ...settings, notifications: value })}
      />

      <ToggleSwitch
        label="Notifications par email"
        checked={settings.emailNotifications}
        onChange={(value) => setSettings({ ...settings, emailNotifications: value })}
      />

      <ToggleSwitch
        label="Sons de notification"
        checked={settings.soundNotifications}
        onChange={(value) => setSettings({ ...settings, soundNotifications: value })}
      />

      <ToggleSwitch
        label="Vibrations"
        checked={settings.vibration}
        onChange={(value) => setSettings({ ...settings, vibration: value })}
      />

      <SectionTitle title="Mode Ne pas déranger" icon={Bell} />
      
      <div className="flex items-center gap-3 p-3.5 rounded-2xl border mb-3" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
        <label className="text-xs font-bold" style={{ color: '#666680' }}>De</label>
        <input type="time" defaultValue="22:00" className="flex-1 px-3 py-2 rounded-lg border" style={{ borderColor: '#D9D9E8' }} />
        <label className="text-xs font-bold" style={{ color: '#666680' }}>à</label>
        <input type="time" defaultValue="08:00" className="flex-1 px-3 py-2 rounded-lg border" style={{ borderColor: '#D9D9E8' }} />
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div>
      <SectionTitle title="Sécurité" icon={Shield} />
      
      <ToggleSwitch
        label="Authentification 2FA (SMS)"
        checked={settings.twoFactorEnabled}
        onChange={(value) => setSettings({ ...settings, twoFactorEnabled: value })}
      />

      <ToggleSwitch
        label="Verrouillage par biométrie"
        checked={settings.biometricEnabled}
        onChange={(value) => setSettings({ ...settings, biometricEnabled: value })}
      />

      <SectionTitle title="Données & Enregistrements" icon={Download} />
      
      <button
        type="button"
        className="w-full py-3 rounded-2xl font-bold border-0 mb-3 transition-all"
        style={{ background: accentBg, color: accentColor, border: `2px solid ${accentColor}` }}
      >
        Voir l'historique des conversations
      </button>

      <ToggleSwitch
        label="Conserver les enregistrements audio"
        checked={settings.keepAudioRecordings}
        onChange={(value) => setSettings({ ...settings, keepAudioRecordings: value })}
      />

      <button
        type="button"
        className="w-full py-3 rounded-2xl font-bold border-0 mb-3 transition-all flex items-center justify-center gap-2"
        style={{ background: accentColor, color: '#fff' }}
      >
        <Download size={16} />
        Exporter mes données (RGPD)
      </button>

      <SectionTitle title="Gérer les permissions" icon={Lock} />
      
      {['Microphone', 'Contacts', 'Localisation', 'Caméra'].map((perm) => (
        <button
          key={perm}
          className="w-full p-3.5 rounded-2xl border mb-2 text-left font-bold transition-all"
          style={{ borderColor: '#D9D9E8', background: '#FFFFFF', color: accentColor }}
        >
          {perm} → Ouvrir les paramètres système
        </button>
      ))}

      <SectionTitle title="Sessions actives" icon={Settings} />
      
      <div className="p-4 rounded-2xl border mb-3" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold m-0" style={{ color: '#16163A' }}>iPhone 13 Pro</p>
            <p className="text-xs m-0 mt-1" style={{ color: '#666680' }}>Dernière utilisation: Il y a 5 minutes</p>
          </div>
          <button className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#FFE0E0', color: '#E53935' }}>
            Déconnecter
          </button>
        </div>
      </div>
    </div>
  );

  const renderAccessibilitySection = () => (
    <div>
      <SectionTitle title="Accessibilité" icon={Settings} />
      
      <div className="mb-4">
        <label className="text-xs font-bold block mb-2" style={{ color: '#666680' }}>Taille du texte: {settings.textSize}%</label>
        <input
          type="range"
          min="80"
          max="150"
          step="10"
          value={settings.textSize}
          onChange={(e) => setSettings({ ...settings, textSize: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      <ToggleSwitch
        label="Contraste élevé"
        checked={settings.highContrast}
        onChange={(value) => setSettings({ ...settings, highContrast: value })}
      />

      <ToggleSwitch
        label="Réduction des animations"
        checked={settings.reduceAnimations}
        onChange={(value) => setSettings({ ...settings, reduceAnimations: value })}
      />

      <ToggleSwitch
        label="Sous-titres pour les réponses vocales"
        checked={settings.enableSubtitles}
        onChange={(value) => setSettings({ ...settings, enableSubtitles: value })}
      />
    </div>
  );

  const renderAboutSection = () => (
    <div>
      <SectionTitle title="À propos" icon={HelpCircle} />
      
      <div className="p-4 rounded-2xl border mb-3" style={{ borderColor: '#D9D9E8', background: '#FFFFFF' }}>
        <p className="text-sm font-bold m-0" style={{ color: '#16163A' }}>VoxManus v2.4.1</p>
        <button className="text-xs font-bold mt-2" style={{ color: accentColor }}>
          Vérifier les mises à jour
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-6">
        {[
          { label: 'Centre d\'aide / FAQ', href: '#' },
          { label: 'Contacter le support', href: '#' },
          { label: 'Donner votre avis', href: '#' },
          { label: 'Conditions générales', href: '#' },
          { label: 'Politique de confidentialité', href: '#' },
          { label: 'Licences open source', href: '#' },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="p-3.5 rounded-2xl border text-left font-bold transition-all"
            style={{ borderColor: '#D9D9E8', background: '#FFFFFF', color: accentColor }}
          >
            {link.label}
          </a>
        ))}
      </div>

      <SectionTitle title="Réseaux sociaux" icon={Globe} />
      
      <div className="flex justify-center gap-3">
        {['f', 'X', 'In', 'YT'].map((social) => (
          <button
            key={social}
            className="w-12 h-12 rounded-full font-bold flex items-center justify-center border-2"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            {social}
          </button>
        ))}
      </div>
    </div>
  );

  const sections = [
    { id: 'profile', label: 'Profil', icon: User, render: renderProfileSection },
    { id: 'account', label: 'Compte', icon: Key, render: renderAccountSection },
    { id: 'preferences', label: 'Préférences', icon: Settings, render: renderPreferencesSection },
    { id: 'voice', label: 'Voix', icon: Volume2, render: renderVoiceSection },
    { id: 'notifications', label: 'Notifications', icon: Bell, render: renderNotificationsSection },
    { id: 'privacy', label: 'Sécurité', icon: Shield, render: renderPrivacySection },
    { id: 'accessibility', label: 'Accessibilité', icon: Settings, render: renderAccessibilitySection },
    { id: 'about', label: 'À propos', icon: HelpCircle, render: renderAboutSection },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(248, 250, 252, 0.8)', borderBottom: '1px solid #E0E0E8' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="w-10 h-10 rounded-full flex items-center justify-center transition-all" style={{ background: '#E0E0E8', color: '#16163A' }}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold m-0" style={{ color: '#16163A' }}>Paramètres</h1>
          </div>
          <BrandLogo compact hideText markSize={40} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {/* Section Navigation */}
        <div className="grid grid-cols-2 gap-2 mb-6 max-h-96 overflow-y-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="p-3 rounded-2xl border-2 text-left transition-all font-bold text-sm"
                style={{
                  background: activeSection === section.id ? accentColor : '#FFFFFF',
                  borderColor: activeSection === section.id ? accentColor : '#D9D9E8',
                  color: activeSection === section.id ? '#fff' : '#16163A',
                }}
              >
                <Icon size={16} className="mb-1" />
                <span className="block">{section.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl p-6 border" style={{ borderColor: '#E0E0E8' }}>
          {sections.find((s) => s.id === activeSection)?.render()}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full mt-6 py-4 rounded-2xl font-bold border-0 flex items-center justify-center gap-2 transition-all"
          style={{ background: '#FFE0E0', color: '#E53935' }}
        >
          <LogOut size={18} />
          Se déconnecter
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="w-full bg-white rounded-t-3xl p-6 animate-fade-in">
            <AlertTriangle size={32} style={{ color: '#E53935' }} className="mb-4" />
            <h2 className="text-xl font-bold mb-2" style={{ color: '#16163A' }}>Supprimer mon compte ?</h2>
            <p className="text-sm mb-4" style={{ color: '#666680' }}>
              Cette action est irréversible. Tous vos données seront supprimées.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="py-3 rounded-2xl font-bold border-0"
                style={{ background: '#F0F0F0', color: '#16163A' }}
              >
                Annuler
              </button>
              <button
                className="py-3 rounded-2xl font-bold border-0"
                style={{ background: '#E53935', color: '#fff' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
