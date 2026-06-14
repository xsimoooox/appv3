import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  registerAccount,
  loginAccount,
  getAuthErrorMessage,
} from '../lib/api';
import { initSocket } from '../lib/socket';
import { registerSocketUser } from '../lib/registerSocketUser';
import { clearVoxManusUser, getHomeRoute, getVoxManusUser, saveVoxManusUser } from '../lib/voxmanusUser';
import { normalizePhoneNumber } from '../lib/phoneUtils';
import BrandLogo from '../components/BrandLogo';

const COUNTRY_CODES = [
  { flag: '🇲🇦', label: 'Maroc', code: '+212' },
  { flag: '🇫🇷', label: 'France', code: '+33' },
  { flag: '🇩🇿', label: 'Algérie', code: '+213' },
  { flag: '🇹🇳', label: 'Tunisie', code: '+216' },
  { flag: '🇸🇦', label: 'Arabie saoudite', code: '+966' },
  { flag: '🇦🇪', label: 'Émirats', code: '+971' },
  { flag: '🇬🇧', label: 'Royaume-Uni', code: '+44' },
  { flag: '🇺🇸', label: 'États-Unis', code: '+1' },
];

const NAME_PATTERN = /^[\p{L}\s'-]{3,}$/u;

function ArrowRightIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M8 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M16 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M6 12.5l4 4 8-8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarningIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M12 4.5 3.5 19h17L12 4.5z" stroke="currentColor" strokeWidth="2" fill="rgba(227, 25, 64, 0.08)" />
      <path d="M12 8.75v4.5" stroke="#E53935" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1" fill="#E53935" />
    </svg>
  );
}

function DeafStatusIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#EEF2FF" />
      <path d="M7 13.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5c0 2.75-1.75 5-4 5.75" stroke="#0000B4" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 8.5v2" stroke="#0000B4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HearingStatusIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#EAF5EB" />
      <path d="M14 7.5c2 1.25 3.5 3.5 3.5 6.5 0 3.75-3 6.5-6.5 6.5-1.5 0-2.75-1-3.5-2.5" stroke="#2E7D32" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="9" cy="12" r="1.5" fill="#2E7D32" />
    </svg>
  );
}

function DeafIllustration({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <rect x="10" y="28" width="100" height="80" rx="24" fill="#EEF2FF" />
      <circle cx="60" cy="44" r="16" fill="#0000B4" opacity="0.25" />
      <path d="M40 74c0-14 10-24 20-24s20 10 20 24" stroke="#0000B4" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M34 48c8-10 18-14 26-14s18 4 26 14" stroke="#0000B4" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M44 40c0 8-2 18 6 22" stroke="#0000B4" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M76 40c0 8 2 18-6 22" stroke="#0000B4" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function HearingIllustration({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <rect x="10" y="20" width="100" height="88" rx="24" fill="#EAF5EB" />
      <path d="M64 28c9 3 16 11 16 20s-7 20-16 24" stroke="#2E7D32" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M52 40c-6 4-8 10-8 16s2 12 8 16" stroke="#2E7D32" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="56" cy="60" r="4" fill="#2E7D32" />
      <path d="M76 42c0 8-4 14-10 18" stroke="#2E7D32" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function RoleBadge({ role }) {
  if (role === 'deaf') {
    return (
      <span
        className="inline-flex items-center gap-2 text-[11px] font-bold px-3.5 py-1.5 rounded-full"
        style={{ background: '#EEEEFF', color: '#0000B4' }}
      >
        <DeafStatusIcon className="w-4 h-4" />
        Personne sourde
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2 text-[11px] font-bold px-3.5 py-1.5 rounded-full"
      style={{ background: '#EAF5EB', color: '#2E7D32' }}
    >
      <HearingStatusIcon className="w-4 h-4" />
      Personne entendante
    </span>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const existingUser = useMemo(() => getVoxManusUser(), []);
  const [step, setStep] = useState('choose');
  const [selectedRole, setSelectedRole] = useState(null);
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+212');
  const [localNumber, setLocalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [accountExists, setAccountExists] = useState(false);
  const [existingAccountName, setExistingAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState(null);

  const digitsOnly = localNumber.replace(/\D/g, '');
  const phoneNumber = useMemo(
    () => normalizePhoneNumber(`${countryCode}${digitsOnly}`),
    [countryCode, digitsOnly],
  );

  const nameError =
    fullName.trim().length > 0 && !NAME_PATTERN.test(fullName.trim())
      ? 'Nom trop court (3 caractères minimum)'
      : '';

  const phoneError =
    digitsOnly.length > 0 && digitsOnly.length < 8 ? 'Numéro invalide' : '';

  const passwordError =
    password.length > 0 && password.length < 6 ? 'Mot de passe : 6 caractères minimum' : '';

  const [isLoginMode, setIsLoginMode] = useState(false);

  const isFormValid = isLoginMode
    ? digitsOnly.length >= 8 && password.length >= 6 && !phoneError && !passwordError
    : selectedRole &&
      NAME_PATTERN.test(fullName.trim()) &&
      digitsOnly.length >= 8 &&
      password.length >= 6 &&
      !nameError &&
      !phoneError &&
      !passwordError;

  const showRecap = !isLoginMode && isFormValid;

  const goToForm = (role) => {
    setSelectedRole(role);
    setAccountExists(false);
    setIsLoginMode(false);
    setAuthError('');
    setStep('form');
  };

  const finishAuthSuccess = async (data) => {
    const user = saveVoxManusUser({
      ...data.user,
      token: data.token,
      avatar: null,
    });

    initSocket(user);
    await registerSocketUser(user);

    setWelcomeUser(user);
    setStep('welcome');
    setSubmitting(false);
    setAccountExists(false);

    setTimeout(() => {
      navigate(getHomeRoute(user.role), { replace: true });
    }, 1500);
  };

  const handleLogin = async () => {
    if (!password || password.length < 6) {
      setAuthError('Entrez votre mot de passe (6 caractères minimum)');
      return;
    }
    setSubmitting(true);
    setAuthError('');

    try {
      const { res, data } = await loginAccount({ phoneNumber, password });

      if (!res.ok) {
        setAuthError(getAuthErrorMessage(res, data));
        setSubmitting(false);
        return;
      }

      await finishAuthSuccess(data);
    } catch {
      setAuthError('Erreur réseau — vérifiez votre connexion internet');
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    setAuthError('');
    setAccountExists(false);

    try {
      const { res, data } = await registerAccount({
        name: fullName.trim(),
        phoneNumber,
        password,
        role: selectedRole,
      });

      if (!res.ok) {
        if (res.status === 409 || data?.code === 'phone_exists' || data?.existingAccount) {
          setAccountExists(true);
          setExistingAccountName(data?.user?.name || '');
          setAuthError(
            data?.user?.name
              ? `Le compte « ${data.user.name} » existe déjà avec ce numéro. Connectez-vous avec votre mot de passe.`
              : 'Ce numéro est déjà enregistré. Connectez-vous avec votre mot de passe.',
          );
        } else {
          setAuthError(getAuthErrorMessage(res, data));
        }
        setSubmitting(false);
        return;
      }

      await finishAuthSuccess(data);
    } catch {
      setAuthError('Erreur réseau — vérifiez votre connexion internet');
      setSubmitting(false);
    }
  };

  const handleContinueSession = async () => {
    if (!existingUser) return;
    setSubmitting(true);
    setAuthError('');

    try {
      initSocket(existingUser);
      await registerSocketUser(existingUser);
      navigate(getHomeRoute(existingUser.role), { replace: true });
    } catch {
      setAuthError('Impossible de se reconnecter au serveur');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'welcome' && welcomeUser) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center px-6 select-none"
        style={{ background: '#F0F0F0' }}
      >
        <div
          className="flex items-center justify-center mb-5"
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#0000B4',
            animation: 'authCheckPop 600ms ease forwards',
          }}
        >
          <CheckIcon className="w-9 h-9 text-white" />
        </div>
        <p className="text-[13px] m-0 mb-1" style={{ color: '#666680' }}>
          Bienvenue,
        </p>
        <p className="text-[20px] font-bold m-0 mb-3" style={{ color: '#16163A' }}>
          {welcomeUser.name}
        </p>
        <RoleBadge role={welcomeUser.role} />
        <div className="flex gap-1.5 mt-10">
          <span className="w-2 h-2 rounded-full bg-[#0000B4] animate-blink-1" />
          <span className="w-2 h-2 rounded-full bg-[#0000B4] animate-blink-2" />
          <span className="w-2 h-2 rounded-full bg-[#0000B4] animate-blink-3" />
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div
        className="fixed inset-0 overflow-y-auto select-none animate-fade-in"
        style={{ background: '#F0F0F0' }}
      >
        <button
          type="button"
          onClick={() => setStep('choose')}
          className="flex items-center gap-2 border-none bg-transparent cursor-pointer p-4"
          style={{ color: '#0000B4' }}
          aria-label="Retour"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>

        <div className="px-5 pb-10 max-w-md mx-auto">
          <div className="flex flex-col items-center mb-4">
            <BrandLogo compact hideText markSize={64} className="mb-4" />
            {!isLoginMode && selectedRole && <RoleBadge role={selectedRole} />}
          </div>

          <h1 className="text-center text-[18px] font-bold m-0" style={{ color: '#16163A' }}>
            {isLoginMode ? 'Se connecter' : 'Créer votre profil'}
          </h1>
          <p className="text-center text-[12px] m-0 mt-2 mb-6" style={{ color: '#666680' }}>
            {isLoginMode ? 'Entrez vos identifiants pour continuer' : 'Entrez vos informations pour commencer'}
          </p>

          <div className="flex flex-col gap-3.5">
            {!isLoginMode && (
              <label className="block">
                <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#666680' }}>
                  Nom complet
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Amina Moussaoui"
                  className="w-full outline-none"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${nameError ? '#E53935' : '#D9D9E8'}`,
                    borderRadius: 10,
                    padding: '13px 14px',
                    fontSize: 14,
                    color: '#16163A',
                  }}
                  onFocus={(e) => {
                    if (!nameError) e.target.style.borderColor = '#0000B4';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = nameError ? '#E53935' : '#D9D9E8';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {nameError && (
                  <span className="block text-[10px] mt-1" style={{ color: '#E53935' }}>
                    {nameError}
                  </span>
                )}
              </label>
            )}

            <div>
              <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#666680' }}>
                Numéro de téléphone
              </span>
              <span className="block text-[10px] italic mb-1.5" style={{ color: '#878787' }}>
                Votre identifiant unique dans l&apos;application
              </span>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="outline-none shrink-0"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #D9D9E8',
                    borderRadius: 10,
                    padding: '13px 10px',
                    width: 96,
                    fontSize: 13,
                    color: '#16163A',
                  }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={localNumber}
                  onChange={(e) => setLocalNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="600 000 001"
                  className="flex-1 outline-none min-w-0"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${phoneError ? '#E53935' : '#D9D9E8'}`,
                    borderRadius: 10,
                    padding: '13px 14px',
                    fontSize: 14,
                    color: '#16163A',
                  }}
                />
              </div>
              {phoneError && (
                <span className="block text-[10px] mt-1" style={{ color: '#E53935' }}>
                  {phoneError}
                </span>
              )}
              <div className="flex items-start gap-2 mt-1.5 text-[10px]" style={{ color: '#D25A1E' }}>
                <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Ce numéro sera votre identifiant permanent. Il ne pourra pas être modifié.</span>
              </div>
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold mb-1.5" style={{ color: '#666680' }}>
                Mot de passe
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
                className="w-full outline-none"
                style={{
                  background: '#FFFFFF',
                  border: `1px solid ${passwordError ? '#E53935' : '#D9D9E8'}`,
                  borderRadius: 10,
                  padding: '13px 14px',
                  fontSize: 14,
                  color: '#16163A',
                }}
              />
              {passwordError && (
                <span className="block text-[10px] mt-1" style={{ color: '#E53935' }}>
                  {passwordError}
                </span>
              )}
            </label>

            {authError && (
              <p className="text-[11px] m-0 text-center" style={{ color: '#E53935' }}>
                {authError}
              </p>
            )}

            {accountExists && (
              <div
                className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2"
                style={{ background: '#EEEEFF', border: '1px solid #0000B4' }}
              >
                <p className="text-[12px] m-0" style={{ color: '#000096' }}>
                  {existingAccountName
                    ? `Compte existant : ${existingAccountName}`
                    : 'Ce numéro a déjà un compte'}
                </p>
                <button
                  type="button"
                  disabled={submitting || password.length < 6}
                  onClick={handleLogin}
                  className="w-full border-none font-bold cursor-pointer"
                  style={{
                    height: 44,
                    borderRadius: 10,
                    fontSize: 12,
                    background: '#0000B4',
                    color: '#fff',
                    opacity: submitting || password.length < 6 ? 0.5 : 1,
                  }}
                >
                  {submitting ? 'Connexion…' : 'Se connecter et continuer'}
                </button>
              </div>
            )}

            {showRecap && (
              <div
                className="rounded-[10px] px-3.5 py-3"
                style={{ background: '#FFFFFF', border: '1px solid #D9D9E8' }}
              >
                <p className="text-[12px] m-0 mb-1" style={{ color: '#16163A' }}>
                  Profil : {fullName.trim()}
                </p>
                <p className="text-[11px] m-0 mb-2" style={{ color: '#666680' }}>
                  {phoneNumber}
                </p>
                <RoleBadge role={selectedRole} />
              </div>
            )}

            <button
              type="button"
              disabled={!isFormValid || submitting}
              onClick={isLoginMode || accountExists ? handleLogin : handleSubmit}
              className="w-full flex items-center justify-center gap-2 border-none font-bold mt-2"
              style={{
                height: 50,
                borderRadius: 12,
                fontSize: 13,
                background: isFormValid && !submitting ? '#0000B4' : '#D9D9E8',
                color: isFormValid && !submitting ? '#fff' : '#878787',
                cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? (
                <span
                  className="inline-block w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"
                />
              ) : (
                <>
                  {isLoginMode || accountExists ? 'Se connecter' : 'Commencer'}
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setAuthError('');
                setAccountExists(false);
              }}
              className="w-full border-none cursor-pointer bg-transparent text-[12px] font-semibold mt-3"
              style={{ color: '#0000B4' }}
            >
              {isLoginMode ? "Pas de compte ? Créer un profil" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col justify-center px-5 py-8 select-none max-w-md mx-auto"
      style={{ background: '#F0F0F0' }}
    >
      <div className="flex flex-col items-center mb-8">
        <BrandLogo hideText markSize={92} className="mb-4" />
        <p className="text-[13px] text-center m-0 mt-2 mb-2 max-w-sm" style={{ color: '#4B5563' }}>
          Choisissez votre profil pour accéder à une interface adaptée et sécurisée.
        </p>
        <div className="h-1.5 w-16 rounded-full bg-[#0000B4] mb-6" />
        <p className="text-[20px] font-extrabold m-0" style={{ color: '#111827' }}>
          Qui êtes-vous ?
        </p>
      </div>

      {existingUser && (
        <div className="mx-1 mb-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleContinueSession}
            disabled={submitting}
            className="w-full border-none cursor-pointer text-[13px] font-bold"
            style={{
              background: '#0000B4',
              color: '#fff',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            Continuer en tant que {existingUser.name}
          </button>
          <button
            type="button"
            onClick={() => {
              clearVoxManusUser();
              window.location.reload();
            }}
            className="w-full border-none cursor-pointer text-[11px] font-semibold bg-transparent"
            style={{ color: '#666' }}
          >
            Changer de compte
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 mx-1">
        <button
          type="button"
          onClick={() => goToForm('deaf')}
          className="w-full text-left border-none cursor-pointer transition-all"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #000096',
            borderRadius: 16,
            padding: '20px 18px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0000B4';
            e.currentTarget.style.background = '#F7F9FF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#000096';
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center shrink-0 rounded-2xl bg-[#EEF2FF] p-3">
              <DeafIllustration className="w-14 h-14" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold" style={{ color: '#111827' }}>
                Personne sourde
              </div>
              <div className="text-[12px] mt-1" style={{ color: '#4B5563' }}>
                Interface LSF dédiée pour le gant et la traduction visuelle.
              </div>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-slate-400" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => goToForm('hearing')}
          className="w-full text-left border-none cursor-pointer transition-all"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #000096',
            borderRadius: 16,
            padding: '20px 18px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2E7D32';
            e.currentTarget.style.background = '#F0F8F2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#000096';
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center shrink-0 rounded-2xl bg-[#EAF5EB] p-3">
              <HearingIllustration className="w-14 h-14" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold" style={{ color: '#111827' }}>
                Personne entendante
              </div>
              <div className="text-[12px] mt-1" style={{ color: '#4B5563' }}>
                Interface texte et voix pour recevoir la traduction LSF.
              </div>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-slate-400" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setIsLoginMode(true);
            setStep('form');
            setAuthError('');
          }}
          className="w-full border-none cursor-pointer font-bold mt-4"
          style={{
            height: 48,
            background: '#FFFFFF',
            border: '1px solid #D9D9E8',
            color: '#0000B4',
            borderRadius: 14,
            fontSize: 13,
          }}
        >
          Déjà un compte ? Se connecter
        </button>
      </div>
    </div>
  );
}
