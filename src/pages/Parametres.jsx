import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  User,
  UserRound,
  X,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useCallSystemContext } from '../context/CallSystemContext';
import { getVoxManusUser, saveVoxManusUser } from '../lib/voxmanusUser';
import { performLogout } from '../lib/logoutSession';
import { changePassword as changePasswordRequest } from '../lib/api';

const PROFILE_KEY = 'voxmanus_profile_data';

function getInitialProfile(user) {
  const names = String(user?.name || '').trim().split(/\s+/);
  return {
    firstName: names[0] || '',
    lastName: names.slice(1).join(' '),
    email: '',
    phone: user?.phoneNumber || '',
    role: user?.role || 'deaf',
    avatar: user?.avatar || null,
    language: 'Français',
    notifications: true,
  };
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`vox-toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

export default function Parametres({ variant }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { disconnectSocket } = useCallSystemContext();
  const [profile, setProfile] = useState(null);
  const [savedProfile, setSavedProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const user = getVoxManusUser();
        if (!user) throw new Error('Compte utilisateur introuvable.');
        const base = getInitialProfile(user);
        const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
        const loaded = { ...base, ...(stored.profile || stored), role: user.role, phone: stored.profile?.phone || stored.phone || user.phoneNumber };
        setProfile(loaded);
        setSavedProfile(loaded);
      } catch (error) {
        setLoadError(error.message || 'Impossible de charger le profil.');
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, []);

  const role = variant === 'hearing' || profile?.role === 'hearing' ? 'hearing' : 'deaf';
  const homePath = role === 'hearing' ? '/entendant/accueil' : '/accueil';
  const dirty = profile && savedProfile && JSON.stringify(profile) !== JSON.stringify(savedProfile);

  const updateProfile = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setFeedback(null);
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Sélectionnez une image valide.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'L’image doit peser moins de 2 Mo.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateProfile('avatar', reader.result);
    reader.onerror = () => setFeedback({ type: 'error', text: 'Impossible de lire cette image.' });
    reader.readAsDataURL(file);
  };

  const cancelChanges = () => {
    setProfile(savedProfile);
    setFeedback({ type: 'info', text: 'Les modifications ont été annulées.' });
  };

  const saveProfile = async (event) => {
    event?.preventDefault?.();
    if (!profile.firstName.trim() || !profile.phone.trim()) {
      setFeedback({ type: 'error', text: 'Le prénom et le numéro de téléphone sont obligatoires.' });
      return;
    }
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      setFeedback({ type: 'error', text: 'Saisissez une adresse e-mail valide.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    try {
      const currentUser = getVoxManusUser();
      saveVoxManusUser({
        ...currentUser,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        phoneNumber: profile.phone,
        role: profile.role,
        avatar: profile.avatar,
      });
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ profile }));
      setSavedProfile(profile);
      setFeedback({ type: 'success', text: 'Profil enregistré avec succès.' });
      window.dispatchEvent(new CustomEvent('voxmanus-notification', {
        detail: { title: 'Profil mis à jour', type: 'success', message: 'Vos nouvelles informations sont enregistrées.' },
      }));
    } catch {
      setFeedback({ type: 'error', text: 'Échec de l’enregistrement. Réessayez.' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordFeedback(null);
    if (passwords.current.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'Le mot de passe actuel doit contenir au moins 6 caractères.' });
      return;
    }
    if (passwords.next.length < 8 || !/[A-Z]/.test(passwords.next) || !/[0-9]/.test(passwords.next)) {
      setPasswordFeedback({ type: 'error', text: 'Le nouveau mot de passe doit contenir 8 caractères, une majuscule et un chiffre.' });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordFeedback({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    setPasswordSaving(true);
    const { res, data } = await changePasswordRequest({
      currentPassword: passwords.current,
      newPassword: passwords.next,
    });
    setPasswordSaving(false);
    if (!res.ok) {
      setPasswordFeedback({ type: 'error', text: data?.error || 'Impossible de modifier le mot de passe.' });
      return;
    }
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordFeedback({ type: 'success', text: 'Mot de passe modifié avec succès.' });
  };

  const deleteAccount = () => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem('sessions');
    localStorage.removeItem('voxmanus_contacts');
    setConfirmAction(null);
    performLogout(navigate, disconnectSocket);
  };

  if (loading) {
    return (
      <div className="vox-settings">
        <div className="vox-settings__skeleton vox-skeleton" />
        <div className="vox-settings__skeleton vox-skeleton" />
        <div className="vox-settings__skeleton vox-skeleton" />
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="vox-settings vox-settings--error">
        <AlertCircle size={32} />
        <h1>Impossible de charger le profil</h1>
        <p>{loadError}</p>
        <button type="button" className="vox-button vox-button--blue" onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }

  return (
    <div className="vox-settings">
      <header className="vox-settings__topbar">
        <button type="button" className="vox-icon-button" onClick={() => navigate(homePath)} aria-label="Retour au tableau de bord"><ArrowLeft size={19} /></button>
        <BrandLogo compact />
        <div>
          <button type="button" className="vox-button vox-button--outline" onClick={cancelChanges} disabled={!dirty || saving}><X size={16} /> Annuler</button>
          <button type="button" className="vox-button vox-button--primary" onClick={saveProfile} disabled={!dirty || saving}>
            {saving ? <span className="vox-spinner" /> : <Save size={16} />} {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </header>

      <main className="vox-settings__main">
        <div className="vox-settings__heading">
          <div><span className="vox-eyebrow">Compte VoxManus</span><h1>Profil et paramètres</h1><p>Gérez vos informations personnelles, votre sécurité et vos préférences.</p></div>
          <span className="vox-role-badge"><ShieldCheck size={15} /> {role === 'hearing' ? 'Personne entendante' : 'Personne sourde'}</span>
        </div>

        {feedback && (
          <div className={`vox-form-feedback vox-form-feedback--${feedback.type}`} role="status">
            {feedback.type === 'success' ? <CheckCircle2 size={17} /> : feedback.type === 'error' ? <AlertCircle size={17} /> : <Bell size={17} />}
            {feedback.text}
          </div>
        )}

        <div className="vox-settings-grid">
          <aside className="vox-profile-card">
            <div className="vox-profile-avatar">
              {profile.avatar ? <img src={profile.avatar} alt={`Photo de ${profile.firstName}`} /> : <UserRound size={40} />}
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="Changer la photo de profil"><Camera size={17} /></button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} hidden />
            </div>
            <h2>{profile.firstName} {profile.lastName}</h2>
            <p>{profile.email || 'E-mail non renseigné'}</p>
            <span>{role === 'hearing' ? 'Compte entendant' : 'Compte sourd'}</span>
            <button type="button" className="vox-button vox-button--outline w-full" onClick={() => fileRef.current?.click()}><Camera size={16} /> Changer la photo</button>
            {profile.avatar && <button type="button" className="vox-text-danger" onClick={() => updateProfile('avatar', null)}>Supprimer la photo</button>}
          </aside>

          <div className="vox-settings__content">
            <form className="vox-settings-card" onSubmit={saveProfile}>
              <div className="vox-settings-card__title"><User size={19} /><div><h2>Informations du compte</h2><p>Données du propriétaire du compte.</p></div></div>
              <div className="vox-form-grid">
                <label className="vox-field"><span>Prénom *</span><input value={profile.firstName} onChange={(event) => updateProfile('firstName', event.target.value)} /></label>
                <label className="vox-field"><span>Nom</span><input value={profile.lastName} onChange={(event) => updateProfile('lastName', event.target.value)} /></label>
                <label className="vox-field"><span><Mail size={13} /> E-mail</span><input type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} placeholder="nom@exemple.com" /></label>
                <label className="vox-field"><span><Phone size={13} /> Téléphone *</span><input type="tel" value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} /></label>
                <label className="vox-field"><span>Type de compte</span><select value={profile.role} onChange={(event) => updateProfile('role', event.target.value)}><option value="deaf">Personne sourde</option><option value="hearing">Personne entendante</option></select></label>
                <label className="vox-field"><span><Languages size={13} /> Langue</span><select value={profile.language} onChange={(event) => updateProfile('language', event.target.value)}><option>Français</option><option>English</option><option>العربية</option></select></label>
              </div>
            </form>

            <form className="vox-settings-card" onSubmit={changePassword}>
              <div className="vox-settings-card__title"><KeyRound size={19} /><div><h2>Changer le mot de passe</h2><p>Utilisez un mot de passe unique et difficile à deviner.</p></div><button type="button" className="vox-icon-button" onClick={() => setShowPasswords((show) => !show)} aria-label="Afficher ou masquer les mots de passe">{showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              <div className="vox-form-grid">
                <label className="vox-field vox-field--full"><span>Mot de passe actuel</span><input type={showPasswords ? 'text' : 'password'} value={passwords.current} onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))} /></label>
                <label className="vox-field"><span>Nouveau mot de passe</span><input type={showPasswords ? 'text' : 'password'} value={passwords.next} onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))} /></label>
                <label className="vox-field"><span>Confirmer</span><input type={showPasswords ? 'text' : 'password'} value={passwords.confirm} onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))} /></label>
              </div>
              {passwordFeedback && <div className={`vox-form-feedback vox-form-feedback--${passwordFeedback.type}`}>{passwordFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{passwordFeedback.text}</div>}
              <button type="submit" className="vox-button vox-button--blue" disabled={passwordSaving}>
                {passwordSaving ? <span className="vox-spinner" /> : <KeyRound size={16} />}
                {passwordSaving ? 'Modification…' : 'Modifier le mot de passe'}
              </button>
            </form>

            <section className="vox-settings-card">
              <div className="vox-settings-card__title"><Bell size={19} /><div><h2>Préférences</h2><p>Personnalisez votre expérience VoxManus.</p></div></div>
              <div className="vox-preference-row"><div><strong>Notifications</strong><span>Recevoir les alertes d’appels et de sessions.</span></div><Toggle checked={profile.notifications} onChange={(value) => updateProfile('notifications', value)} label="Notifications" /></div>
              <div className="vox-preference-row"><div><strong>Thème de l’application</strong><span>Le mode clair VoxManus garantit un contraste accessible.</span></div><span className="vox-status vox-status--success">Clair</span></div>
            </section>

            <section className="vox-settings-card vox-settings-card--danger">
              <div className="vox-settings-card__title"><AlertCircle size={19} /><div><h2>Zone sensible</h2><p>Ces actions nécessitent une confirmation.</p></div></div>
              <div className="vox-danger-actions">
                <button type="button" className="vox-button vox-button--outline" onClick={() => setConfirmAction('logout')}><LogOut size={16} /> Se déconnecter</button>
                <button type="button" className="vox-button vox-button--danger" onClick={() => setConfirmAction('delete')}><Trash2 size={16} /> Supprimer le compte</button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {confirmAction && (
        <div className="vox-modal-backdrop">
          <div className="vox-modal" role="dialog" aria-modal="true">
            <span className="vox-modal__danger-icon">{confirmAction === 'delete' ? <Trash2 size={22} /> : <LogOut size={22} />}</span>
            <h2>{confirmAction === 'delete' ? 'Supprimer définitivement le compte ?' : 'Se déconnecter de VoxManus ?'}</h2>
            <p>{confirmAction === 'delete' ? 'Le profil, les contacts locaux et l’historique seront supprimés. Cette action est irréversible.' : 'Votre session sera fermée sur cet appareil.'}</p>
            <div className="vox-modal__actions">
              <button type="button" className="vox-button vox-button--outline" onClick={() => setConfirmAction(null)}>Annuler</button>
              <button type="button" className="vox-button vox-button--danger" onClick={() => confirmAction === 'delete' ? deleteAccount() : performLogout(navigate, disconnectSocket)}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
